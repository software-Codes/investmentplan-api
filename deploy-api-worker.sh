#!/bin/bash

# Enhanced Deployment Script for AWS ECS with Robust Error Handling and Logging

# Strict mode for better error handling
set -euo pipefail

# Define color codes for enhanced readability
declare -r YELLOW='\033[0;33m'
declare -r RED='\033[0;31m'
declare -r GREEN='\033[0;32m'
declare -r BLUE='\033[0;34m'
declare -r NC='\033[0m' # No Color

# Logging and error handling functions
log_error() {
    echo -e "${RED}[ERROR] $*${NC}" >&2
}

log_info() {
    echo -e "${BLUE}[INFO] $*${NC}"
}

log_success() {
    echo -e "${GREEN}[SUCCESS] $*${NC}"
}

log_warning() {
    echo -e "${YELLOW}[WARNING] $*${NC}"
}

# Error handler
handle_error() {
    local line_number=$1
    local command=$2
    log_error "Error occurred at line $line_number: $command"
    exit 1
}

# Trap errors
trap 'handle_error $LINENO "$BASH_COMMAND"' ERR

# Check for required dependencies
check_dependencies() {
    local dependencies=("aws" "docker" "jq")
    for dep in "${dependencies[@]}"; do
        if ! command -v "$dep" &>/dev/null; then
            log_error "$dep is not installed. Please install it and try again."
            exit 1
        fi
    done
}

# Configuration and Initialization
initialize_configuration() {
    # Traverse up the directory tree to find globalenvdev.config
    local dir
    dir=$(pwd)
    while [[ "$dir" != "/" ]]; do
        if [[ -f "$dir/globalenv.config" ]]; then
            # shellcheck source=/dev/null
            source "$dir/globalenv.config"
            return 0
        fi
        dir=$(dirname "$dir")
    done

    log_error "globalenv.config not found"
    exit 1
}

# Validate required environment variables
validate_configuration() {
    local required_vars=(
        "ENVIRONMENT_PREFIX"
        "PROJECT_PREFIX"
        "PROJECT_LOCATION"
        "LOG_FOLDER"
        "PROJECT_RESOURCE_GROUP"
        "PROJECT_SUBSCRIPTION_ID"
    )

    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log_error "Required environment variable $var is not set"
            return 1
        fi
    done
}

# AWS Authentication and Context Setup
setup_aws_context() {
    log_info "Checking AWS CLI authentication"
    
    # Check if already authenticated
    if ! aws sts get-caller-identity &>/dev/null; then
        log_warning "Not authenticated with AWS. Please run 'aws configure' or use AWS credentials."
        exit 1
    fi

    log_info "Authenticated AWS Account: $AWS_ACCOUNT_ID"
    log_info "Region: $AWS_REGION"
}

# Create or get service principal for GitHub integration
setup_service_principal() {
    local sp_name="${ENVIRONMENT_PREFIX}-${PROJECT_PREFIX}-github-sp"
    
    log_info "Setting up service principal for GitHub integration: $sp_name"
    
    # Check if service principal exists
    local sp_id=""
    local sp_json=""
    
    # Get the service principal with proper error handling
    sp_json=$(az ad sp list --display-name "$sp_name" --query "[0]" -o json 2>/dev/null || echo "null")
    
    if [[ "$sp_json" != "null" && -n "$sp_json" ]]; then
        log_info "Service principal already exists, retrieving details..."
        
        # Get the object ID from the existing service principal
        sp_id=$(echo "$sp_json" | jq -r '.appId // empty')
        
        # Validate that we have a valid service principal ID
        if [[ -z "$sp_id" ]]; then
            log_error "Failed to retrieve service principal ID. Creating a new one..."
            # Create a new one since we couldn't get valid details
            local sp_output
            sp_output=$(az ad sp create-for-rbac --name "$sp_name" --role Contributor --scopes "/subscriptions/${PROJECT_SUBSCRIPTION_ID}/resourceGroups/${PROJECT_RESOURCE_GROUP}" -o json)
            
            sp_id=$(echo "$sp_output" | jq -r '.appId')
            log_success "Created new service principal $sp_name with ID: $sp_id"
        else
            log_info "Retrieved existing service principal with ID: $sp_id"
            
            # Check if contributor role is assigned to resource group
            if [[ -n "$sp_id" ]]; then
                log_info "Ensuring service principal has necessary role assignments..."
                
                local assignment_exists
                assignment_exists=$(az role assignment list --assignee "$sp_id" --scope "/subscriptions/${PROJECT_SUBSCRIPTION_ID}/resourceGroups/${PROJECT_RESOURCE_GROUP}" --query "[?roleDefinitionName=='Contributor']" -o json)
                
                if [[ "$assignment_exists" == "[]" ]]; then
                    log_info "Assigning Contributor role to service principal on resource group ${PROJECT_RESOURCE_GROUP}"
                    az role assignment create --assignee "$sp_id" --role Contributor --scope "/subscriptions/${PROJECT_SUBSCRIPTION_ID}/resourceGroups/${PROJECT_RESOURCE_GROUP}"
                else
                    log_info "Contributor role already assigned to service principal"
                fi
            fi
        fi
    else
        log_info "Creating new service principal: $sp_name"
        # Create a new service principal with Contributor role
        local sp_output
        sp_output=$(az ad sp create-for-rbac --name "$sp_name" --role Contributor --scopes "/subscriptions/${PROJECT_SUBSCRIPTION_ID}/resourceGroups/${PROJECT_RESOURCE_GROUP}" -o json)
        
        # Extract and store service principal ID
        sp_id=$(echo "$sp_output" | jq -r '.appId')
        local sp_password=$(echo "$sp_output" | jq -r '.password')
        local sp_tenant=$(echo "$sp_output" | jq -r '.tenant')
        
        log_success "Created new service principal $sp_name with ID: $sp_id"
        
        # Wait for AAD propagation
        log_info "Waiting for AAD propagation (30 seconds)..."
        sleep 30
    fi
    
    # Validate service principal ID before continuing
    if [[ -z "$sp_id" ]]; then
        log_error "Failed to get or create a valid service principal ID. Exiting."
        exit 1
    fi
    
    # Export service principal details for use in deployment
    SP_ID="$sp_id"
    export SP_ID
    
    log_info "Service principal setup complete with ID: $SP_ID"
}

# ECR Repository Management
prepare_ecr_repository() {
    log_info "Checking/Creating ECR Repository: $ECR_REPOSITORY_NAME"
    
    # Check if repository exists, create if not
    if ! aws ecr describe-repositories --repository-names "$ECR_REPOSITORY_NAME" &>/dev/null; then
        aws ecr create-repository \
            --repository-name "$ECR_REPOSITORY_NAME" \
            --region "$AWS_REGION"
        log_success "ECR Repository created"
    else
        log_info "ECR Repository already exists"
    fi

    # Login to ACR
    az acr login --name "$registry_name"
}

# Prepare Container Apps Environment
prepare_container_apps_environment() {
    local environment_name="${ENVIRONMENT_PREFIX}-${PROJECT_PREFIX}-BackendContainerAppsEnv"
    local container_app_name="${ENVIRONMENT_PREFIX}-${PROJECT_PREFIX}-worker"
    local registry_url="${ENVIRONMENT_PREFIX}${PROJECT_PREFIX}contregistry.azurecr.io"

    log_info "Preparing Container Apps Environment: $environment_name"

    # Create Container Apps Environment if not exists
    if ! az containerapp env show --name "$environment_name" --resource-group "$PROJECT_RESOURCE_GROUP" &>/dev/null; then
        log_warning "Container Apps Environment does not exist. Creating..."
        az containerapp env create \
            --name "$environment_name" \
            --resource-group "$PROJECT_RESOURCE_GROUP" \
            --location "$PROJECT_LOCATION"
    fi

    # Output environment and app details for reference
    echo "Environment Name: $environment_name"
    echo "Container App Name: $container_app_name"
    echo "Registry URL: $registry_url"
}

# Build and deploy container
deploy_container_app() {
    local environment_name="${ENVIRONMENT_PREFIX}-${PROJECT_PREFIX}-BackendContainerAppsEnv"
    local container_app_name="${ENVIRONMENT_PREFIX}-${PROJECT_PREFIX}-worker"
    local registry_url="${ENVIRONMENT_PREFIX}${PROJECT_PREFIX}contregistry.azurecr.io"
    local repo_url="https://github.com/software-Codes/investmentplan-api"
    local branch="main"

    log_info "Deploying Container App: $container_app_name"

    # Deploy container app with valid parameters
    az containerapp up \
        --name "$container_app_name" \
        --resource-group "$PROJECT_RESOURCE_GROUP" \
        --environment "$environment_name" \
        --repo "$repo_url" \
        --branch "$branch" \
        --registry-server "$registry_url" \
        --ingress external \
        --target-port 3000


    # Update container app settings
    log_info "Configuring Container App scaling and resources"
    az containerapp update \
        --name "$container_app_name" \
        --resource-group "$PROJECT_RESOURCE_GROUP" \
        --cpu 0.25 \
        --memory 0.5Gi \
        --min-replicas 1 \
        --max-replicas 10 \


    # Optional: Disable public ingress if internal service
    # az containerapp ingress disable \
    #     --name "$container_app_name" \
    #     --resource-group "$PROJECT_RESOURCE_GROUP"
}

# Main deployment workflow
main() {
    local timestamp
    timestamp=$(date +"%Y%m%d_%H%M%S")
    local log_file="${LOG_FOLDER}/deploy_worker_${timestamp}.log"

    # Redirect output to log file and console
    exec > >(tee -a "$log_file") 2>&1

    log_info "Starting Container App Deployment Workflow"

    # Azure deployment steps
    setup_azure_context
    prepare_container_registry
    prepare_container_apps_environment
    deploy_container_app

    log_success "Deployment completed successfully"
    log_info "Detailed logs available at: $log_file"
}

# Execute main function
main "$@"
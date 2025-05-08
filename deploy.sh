#!/bin/bash

# Enhanced Deployment Script for Azure Container Apps with Robust Error Handling and Logging

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

# Configuration and Initialization
initialize_configuration() {
    # Traverse up the directory tree to find globalenv.config
    local dir
    dir=$(pwd)
    while [[ "$dir" != "/" ]]; do
        if [[ -f "$dir/globalenv.config" ]]; then
            # shellcheck source=/dev/null
            source "$dir/globalenv.config"
            log_info "Loaded configuration from $dir/globalenv.config"
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
    
    # Create log directory if it doesn't exist
    mkdir -p "${LOG_FOLDER}"
}

# Azure authentication and subscription setup
setup_azure_context() {
    log_info "Checking Azure CLI authentication"
    
    # Login if not already authenticated
    if ! az account show &>/dev/null; then
        log_warning "Not logged in to Azure CLI. Initiating login..."
        az login
    fi

    # Set the target subscription
    log_info "Setting Azure subscription to ${PROJECT_SUBSCRIPTION_ID}"
    az account set --subscription "${PROJECT_SUBSCRIPTION_ID}"

    # Verify subscription is set correctly
    local current_subscription
    current_subscription=$(az account show --query id -o tsv)
    if [[ "$current_subscription" != "$PROJECT_SUBSCRIPTION_ID" ]]; then
        log_error "Failed to set Azure subscription. Current: $current_subscription, Expected: $PROJECT_SUBSCRIPTION_ID"
        return 1
    fi
    
    # Ensure we have permissions to create service principals if needed
    log_info "Checking permissions for service principal creation"
    
    # Create resource group if it doesn't exist
    if ! az group show --name "$PROJECT_RESOURCE_GROUP" &>/dev/null; then
        log_warning "Resource group does not exist. Creating..."
        az group create --name "$PROJECT_RESOURCE_GROUP" --location "$PROJECT_LOCATION"
    fi
}

# Prepare Azure Container Registry
prepare_container_registry() {
    local registry_name="${ENVIRONMENT_PREFIX}${PROJECT_PREFIX}contregistry"
    
    log_info "Checking Azure Container Registry: $registry_name"
    
    # Check if registry exists, create if not
    if ! az acr show --name "$registry_name" &>/dev/null; then
        log_warning "Container Registry does not exist. Creating..."
        az acr create \
            --name "$registry_name" \
            --resource-group "$PROJECT_RESOURCE_GROUP" \
            --sku Basic \
            --admin-enabled true
    fi

    # Get registry credentials
    local acr_username
    local acr_password
    
    log_info "Retrieving ACR credentials"
    acr_username=$(az acr credential show --name "$registry_name" --query "username" -o tsv)
    acr_password=$(az acr credential show --name "$registry_name" --query "passwords[0].value" -o tsv)
    
    # Login to ACR
    log_info "Logging in to ACR: $registry_name"
    echo "$acr_password" | docker login "$registry_name.azurecr.io" --username "$acr_username" --password-stdin
    
    # Export variables for later use
    export ACR_USERNAME="$acr_username"
    export ACR_PASSWORD="$acr_password"
    export ACR_NAME="$registry_name"
}

# Create service principal for container app
create_service_principal() {
    local sp_name="${ENVIRONMENT_PREFIX}-${PROJECT_PREFIX}-worker-sp"
    
    log_info "Creating service principal: $sp_name"
    
    # Check if the service principal already exists
    local sp_exists
    sp_exists=$(az ad sp list --display-name "$sp_name" --query "[].displayName" -o tsv || echo "")
    
    if [[ -n "$sp_exists" ]]; then
        log_warning "Service principal already exists. Using existing service principal."
        
        # Get service principal ID
        local sp_id
        sp_id=$(az ad sp list --display-name "$sp_name" --query "[].appId" -o tsv)
        
        # Reset credentials
        log_info "Resetting credentials for existing service principal"
        local sp_password
        sp_password=$(az ad sp credential reset --id "$sp_id" --query "password" -o tsv)
        
        # Export service principal credentials
        export SP_ID="$sp_id"
        export SP_PASSWORD="$sp_password"
    else
        # Create new service principal with Contributor role
        log_info "Creating new service principal with required permissions"
        local sp_output
        sp_output=$(az ad sp create-for-rbac \
            --name "$sp_name" \
            --role "Contributor" \
            --scopes "/subscriptions/${PROJECT_SUBSCRIPTION_ID}/resourceGroups/${PROJECT_RESOURCE_GROUP}" \
            --query "{id:appId, password:password}" \
            -o json)
        
        # Extract and export service principal credentials
        export SP_ID=$(echo "$sp_output" | jq -r .id)
        export SP_PASSWORD=$(echo "$sp_output" | jq -r .password)
        
        # Add AcrPush role assignment
        log_info "Assigning AcrPush role to service principal"
        az role assignment create \
            --assignee "$SP_ID" \
            --role "AcrPush" \
            --scope "/subscriptions/${PROJECT_SUBSCRIPTION_ID}/resourceGroups/${PROJECT_RESOURCE_GROUP}/providers/Microsoft.ContainerRegistry/registries/${ACR_NAME}"
            
        # Allow time for role assignment to propagate
        log_info "Waiting for role assignments to propagate..."
        sleep 30
    fi
    
    log_success "Service principal setup complete"
}

# Prepare Container Apps Environment
prepare_container_apps_environment() {
    local environment_name="${ENVIRONMENT_PREFIX}-${PROJECT_PREFIX}-BackendContainerAppsEnv"
    local container_app_name="${ENVIRONMENT_PREFIX}-${PROJECT_PREFIX}-worker"
    local registry_url="${ACR_NAME}.azurecr.io"

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
    
    # Export for later use
    export CONTAINER_ENV_NAME="$environment_name"
    export CONTAINER_APP_NAME="$container_app_name"
    export REGISTRY_URL="$registry_url"
}

# Build and deploy container
deploy_container_app() {
    log_info "Deploying Container App: $CONTAINER_APP_NAME"
    
    local repo_url="https://github.com/software-Codes/investmentplan-api"
    local branch="main"

    # Check if the container app already exists
    if az containerapp show --name "$CONTAINER_APP_NAME" --resource-group "$PROJECT_RESOURCE_GROUP" &>/dev/null; then
        log_warning "Container App already exists. Updating..."
        
        # Update existing container app
        az containerapp update \
            --name "$CONTAINER_APP_NAME" \
            --resource-group "$PROJECT_RESOURCE_GROUP" \
            --cpu 0.25 \
            --memory 0.5Gi \
            --min-replicas 1 \
            --max-replicas 10
    else
        # Create new container app with explicit registry credentials to avoid service principal creation
        log_info "Creating new Container App with specified registry credentials"
        
        az containerapp create \
            --name "$CONTAINER_APP_NAME" \
            --resource-group "$PROJECT_RESOURCE_GROUP" \
            --environment "$CONTAINER_ENV_NAME" \
            --registry-server "$REGISTRY_URL" \
            --registry-username "$ACR_USERNAME" \
            --registry-password "$ACR_PASSWORD" \
            --cpu 0.25 \
            --memory 0.5Gi \
            --min-replicas 1 \
            --max-replicas 10 \
            --ingress external \
            --target-port 8000 \
            --image "$REGISTRY_URL/investmentplan-api:latest"
    fi
    
    # Deploy container app with GitHub integration (optional)
    # Note: This is separate to allow for flexibility
    setup_github_integration
}

# Setup GitHub integration for Container App
setup_github_integration() {
    log_info "Setting up GitHub integration"
    
    local repo_url="https://github.com/software-Codes/investmentplan-api"
    local branch="main"
    
    # Check if we have GitHub integration credentials in the config
    if [[ -n "${GITHUB_PAT:-}" ]]; then
        log_info "Configuring GitHub continuous deployment"
        
        # Configure GitHub integration using PAT
        az containerapp github-action add \
            --name "$CONTAINER_APP_NAME" \
            --resource-group "$PROJECT_RESOURCE_GROUP" \
            --repo-url "$repo_url" \
            --branch "$branch" \
            --registry-url "$REGISTRY_URL" \
            --registry-username "$ACR_USERNAME" \
            --registry-password "$ACR_PASSWORD" \
            --github-token "$GITHUB_PAT" \
            --service-principal-client-id "$SP_ID" \
            --service-principal-client-secret "$SP_PASSWORD" \
            --service-principal-tenant-id "$(az account show --query tenantId -o tsv)"
    else
        log_warning "GitHub Personal Access Token not found in config. Skipping GitHub integration."
        log_info "To enable CI/CD, add GITHUB_PAT to your globalenv.config file."
    fi
}

# Main deployment workflow
main() {
    # Configuration and setup must happen FIRST
    initialize_configuration
    validate_configuration

    # Now safe to use LOG_FOLDER
    local timestamp
    timestamp=$(date +"%Y%m%d_%H%M%S")
    local log_file="${LOG_FOLDER}/deploy_worker_${timestamp}.log"

    # Create log directory if it doesn't exist
    mkdir -p "$(dirname "$log_file")"

    # Redirect output to log file and console
    exec > >(tee -a "$log_file") 2>&1

    log_info "Starting Container App Deployment Workflow"

    # Azure deployment steps
    setup_azure_context
    prepare_container_registry
    create_service_principal
    prepare_container_apps_environment
    deploy_container_app

    log_success "Deployment completed successfully"
    log_info "Detailed logs available at: $log_file"
}

# Execute main function with error handling
main "$@"
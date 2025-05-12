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
    # Load configuration from globalenv.config or set defaults
    export ENVIRONMENT_PREFIX="${ENVIRONMENT_PREFIX:-dev}"
    export PROJECT_PREFIX="${PROJECT_PREFIX:-nep}"
    export AWS_REGION="${AWS_REGION:-us-east-1}"
    export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    
    # Derived names
    export ECR_REPOSITORY_NAME="${ENVIRONMENT_PREFIX}-${PROJECT_PREFIX}-repo"
    export ECS_CLUSTER_NAME="${ENVIRONMENT_PREFIX}-${PROJECT_PREFIX}-cluster"
    export ECS_SERVICE_NAME="${ENVIRONMENT_PREFIX}-${PROJECT_PREFIX}-service"
    export ECS_TASK_DEFINITION_NAME="${ENVIRONMENT_PREFIX}-${PROJECT_PREFIX}-task"
    
    # Logging
    export LOG_FOLDER="${LOG_FOLDER:-${HOME}/logs}"
    mkdir -p "$LOG_FOLDER"
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

    # Authenticate Docker with ECR
    aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
}

# Docker Image Build and Push
build_and_push_image() {
    local image_tag="${ENVIRONMENT_PREFIX}-${PROJECT_PREFIX}-$(date +%Y%m%d-%H%M%S)"
    local full_image_uri="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY_NAME:$image_tag"

    log_info "Building Docker image"
    docker build -t "$ECR_REPOSITORY_NAME:latest" -t "$full_image_uri" .

    log_info "Pushing image to ECR: $full_image_uri"
    docker push "$full_image_uri"
    docker push "$ECR_REPOSITORY_NAME:latest"

    echo "$full_image_uri"  # Return the full image URI for task definition
}

# ECS Cluster and Service Setup
prepare_ecs_infrastructure() {
    # Create ECS Cluster if not exists
    if ! aws ecs describe-clusters --clusters "$ECS_CLUSTER_NAME" &>/dev/null; then
        aws ecs create-cluster --cluster-name "$ECS_CLUSTER_NAME"
        log_success "ECS Cluster created: $ECS_CLUSTER_NAME"
    fi
}

# Create ECS Task Definition
create_ecs_task_definition() {
    local image_uri="$1"
    
    local task_definition_json=$(cat <<EOF
{
    "family": "$ECS_TASK_DEFINITION_NAME",
    "networkMode": "awsvpc",
    "requiresCompatibilities": ["FARGATE"],
    "cpu": "256",
    "memory": "512",
    "executionRoleArn": "arn:aws:iam::$AWS_ACCOUNT_ID:role/ecsTaskExecutionRole",
    "containerDefinitions": [{
        "name": "${ENVIRONMENT_PREFIX}-${PROJECT_PREFIX}-container",
        "image": "$image_uri",
        "portMappings": [{
            "containerPort": 3000,
            "hostPort": 3000,
            "protocol": "tcp"
        }],
        "essential": true
    }]
}
EOF
)

    local task_definition_response
    task_definition_response=$(aws ecs register-task-definition \
        --cli-input-json "$task_definition_json")

    local revision
    revision=$(echo "$task_definition_response" | jq '.taskDefinition.revision')
    log_success "ECS Task Definition created with revision $revision"

    echo "$revision"
}

# Create or Update ECS Service
create_or_update_ecs_service() {
    local task_definition_revision="$1"
    
    # Subnets and Security Group (you'll need to replace these with your actual VPC details)
    local SUBNET_IDS="subnet-12345678,subnet-87654321"
    local SECURITY_GROUP_ID="sg-12345678"

    # Check if service exists
    if aws ecs describe-services --cluster "$ECS_CLUSTER_NAME" --services "$ECS_SERVICE_NAME" &>/dev/null; then
        log_info "Updating existing ECS service"
        aws ecs update-service \
            --cluster "$ECS_CLUSTER_NAME" \
            --service "$ECS_SERVICE_NAME" \
            --task-definition "$ECS_TASK_DEFINITION_NAME:$task_definition_revision" \
            --force-new-deployment
    else
        log_info "Creating new ECS service"
        aws ecs create-service \
            --cluster "$ECS_CLUSTER_NAME" \
            --service-name "$ECS_SERVICE_NAME" \
            --task-definition "$ECS_TASK_DEFINITION_NAME:$task_definition_revision" \
            --launch-type FARGATE \
            --desired-count 1 \
            --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[$SECURITY_GROUP_ID],assignPublicIp=ENABLED}"
    fi

    log_success "ECS Service deployment initiated"
}

# Main deployment workflow
main() {
    local timestamp
    timestamp=$(date +"%Y%m%d_%H%M%S")
    local log_file="${LOG_FOLDER}/aws_deploy_${timestamp}.log"
    exec > >(tee -a "$log_file") 2>&1

    log_info "Starting AWS ECS Deployment Workflow"
    
    check_dependencies
    initialize_configuration
    setup_aws_context
    prepare_ecr_repository
    
    local image_uri
    image_uri=$(build_and_push_image)
    
    prepare_ecs_infrastructure
    local task_revision
    task_revision=$(create_ecs_task_definition "$image_uri")
    create_or_update_ecs_service "$task_revision"

    log_success "Deployment completed successfully"
    log_info "Detailed logs available at: $log_file"
}

# Execute main function
main "$@"
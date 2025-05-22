#!/bin/bash

# Set strict mode for better error handling
set -euo pipefail

# Validate .env file exists
ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found!"
  exit 1
fi

# Set variables
APP_NAME="apiinfrahdev"
RESOURCE_GROUP="DevOps"
ENV_NAME="neptune"

# Function to select an appropriate Azure region
select_azure_region() {
  # Predefined list of recommended regions
  RECOMMENDED_REGIONS=(
    "eastus"        # United States East
    "westeurope"    # Europe West
    "southeastasia" # Southeast Asia
    "eastus2"       # United States East 2
    "northeurope"   # Europe North
    "westus2"       # United States West 2
  )

  echo "Selecting an appropriate Azure region for Container Apps..."
  
  # Fetch available locations
  AVAILABLE_LOCATIONS=$(az containerapp environment create --help | grep -A 10 "location" | grep -oP '(?<=--location\s)[^\s]+' | sort | uniq)

  # Try recommended regions first
  for region in "${RECOMMENDED_REGIONS[@]}"; do
    if echo "$AVAILABLE_LOCATIONS" | grep -q "^$region$"; then
      echo "$region"
      return 0
    fi
  done

  # If no recommended region works, prompt user
  echo "Error: Could not automatically select a region." >&2
  echo "Available regions:" >&2
  echo "$AVAILABLE_LOCATIONS" >&2
  
  # Prompt user to choose a region
  read -p "Please enter a region from the list above: " USER_SELECTED_REGION
  
  # Validate user input
  if echo "$AVAILABLE_LOCATIONS" | grep -q "^$USER_SELECTED_REGION$"; then
    echo "$USER_SELECTED_REGION"
  else
    echo "Invalid region selected. Exiting." >&2
    exit 1
  fi
}

# Check if az CLI is installed
if ! command -v az &> /dev/null; then
  echo "Error: Azure CLI (az) could not be found. Please install it."
  exit 1
fi

# Select appropriate location
LOCATION=$(select_azure_region)

# Function to safely load environment variables
load_env_vars() {
  # Read .env file, ignore comments and empty lines
  while IFS='=' read -r key value || [ -n "$key" ]; do
    # Skip comment lines and empty lines
    [[ "$key" =~ ^\s*#.* ]] && continue
    [[ -z "$key" ]] && continue
    
    # Trim whitespace and remove quotes
    key=$(echo "$key" | xargs)
    value=$(echo "$value" | xargs)
    
    # Export only if key is a valid identifier
    if [[ "$key" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
      export "$key"="$value"
    else
      echo "Warning: Skipping invalid environment variable: $key"
    fi
  done < "$ENV_FILE"
}

# Load environment variables
load_env_vars

# Authenticate to Azure (if not already authenticated)
az login || true

# Validate Azure CLI container app extension
if ! az containerapp --version &> /dev/null; then
  echo "Installing Azure Container Apps extension..."
  az extension add --name containerapp
fi

# Create managed environment
az containerapp env create \
  --name "$ENV_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION"

# Prepare environment variables for deployment
ENV_VARS_ARGS=""
while IFS='=' read -r key value || [ -n "$key" ]; do
  # Skip comment lines and empty lines
  [[ "$key" =~ ^\s*#.* ]] && continue
  [[ -z "$key" ]] && continue
  
  # Trim whitespace and remove quotes
  key=$(echo "$key" | xargs)
  value=$(echo "$value" | xargs)
  
  # Add to environment variables arguments
  if [[ "$key" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
    ENV_VARS_ARGS+=" --env-vars $key='$value'"
  fi
done < "$ENV_FILE"

# Deploy container app
# shellcheck disable=SC2086
az containerapp up \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --environment "$ENV_NAME" \
  --source . \
  $ENV_VARS_ARGS

# Check deployment status
if [ $? -eq 0 ]; then
  echo "Deployment successful."
  
  # Show logs
  az containerapp logs show \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP"
else
  echo "Deployment failed."
  exit 1
fi
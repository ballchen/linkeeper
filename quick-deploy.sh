#!/bin/bash

# Quick Deploy Script for LinkKeeper
# This script performs a fast deployment with minimal checks

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[QUICK-DEPLOY]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_info "🚀 Quick deployment starting..."

# Build and deploy both
log_info "Building backend..."
cd server && npm run build

log_info "Restarting backend..."
pm2 restart url-saver-server

log_info "Building frontend..."
cd ../client && npm run build

log_info "Deploying frontend..."
sudo cp -r dist/* /home/ball/project/linkeeper/client/dist/
sudo nginx -s reload

log_success "Quick deployment completed! ⚡" 
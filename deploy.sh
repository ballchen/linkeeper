#!/bin/bash

# LinkKeeper Deployment Script
# This script deploys both frontend and backend

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
FRONTEND_DIST_PATH="/home/ball/project/linkeeper/client/dist"
BACKEND_PATH="/home/ball/project/linkeeper/server"
PM2_APP_NAME="url-saver-server"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] && [ ! -d "client" ] && [ ! -d "server" ]; then
    log_error "Please run this script from the project root directory"
    exit 1
fi

# Parse command line arguments
DEPLOY_FRONTEND=true
DEPLOY_BACKEND=true
SKIP_BUILD=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --frontend-only)
            DEPLOY_BACKEND=false
            shift
            ;;
        --backend-only)
            DEPLOY_FRONTEND=false
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --frontend-only    Deploy only frontend"
            echo "  --backend-only     Deploy only backend"
            echo "  --skip-build       Skip build process"
            echo "  -h, --help         Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

log_info "Starting LinkKeeper deployment..."
log_info "Frontend: $($DEPLOY_FRONTEND && echo 'YES' || echo 'NO')"
log_info "Backend: $($DEPLOY_BACKEND && echo 'YES' || echo 'NO')"
log_info "Skip build: $($SKIP_BUILD && echo 'YES' || echo 'NO')"

# Deploy Backend
if [ "$DEPLOY_BACKEND" = true ]; then
    log_info "Deploying backend..."
    
    cd server
    
    if [ "$SKIP_BUILD" = false ]; then
        log_info "Installing backend dependencies..."
        npm install
        
        log_info "Building backend..."
        npm run build
    fi
    
    # Check if PM2 is running the app
    if pm2 describe $PM2_APP_NAME > /dev/null 2>&1; then
        log_info "Restarting PM2 application..."
        pm2 restart $PM2_APP_NAME
    else
        log_info "Starting PM2 application..."
        pm2 start ecosystem.config.js --env production
    fi
    
    log_success "Backend deployed successfully!"
    cd ..
fi

# Deploy Frontend
if [ "$DEPLOY_FRONTEND" = true ]; then
    log_info "Deploying frontend..."
    
    cd client
    
    if [ "$SKIP_BUILD" = false ]; then
        log_info "Installing frontend dependencies..."
        npm install
        
        log_info "Building frontend..."
        npm run build
    fi
    
    # Create backup of current dist (if exists)
    if [ -d "$FRONTEND_DIST_PATH" ]; then
        log_info "Creating backup of current frontend..."
        sudo cp -r "$FRONTEND_DIST_PATH" "${FRONTEND_DIST_PATH}.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    # Deploy new build
    log_info "Copying new build to nginx directory..."
    sudo mkdir -p "$FRONTEND_DIST_PATH"
    sudo cp -r dist/* "$FRONTEND_DIST_PATH/"
    
    # Set proper permissions
    sudo chown -R www-data:www-data "$FRONTEND_DIST_PATH"
    sudo chmod -R 755 "$FRONTEND_DIST_PATH"
    
    # Test nginx configuration
    log_info "Testing nginx configuration..."
    if sudo nginx -t; then
        log_info "Reloading nginx..."
        sudo nginx -s reload
        log_success "Frontend deployed successfully!"
    else
        log_error "Nginx configuration test failed!"
        log_warning "Rolling back to previous version..."
        
        # Rollback if backup exists
        LATEST_BACKUP=$(sudo find $(dirname "$FRONTEND_DIST_PATH") -name "dist.backup.*" -type d | sort | tail -1)
        if [ -n "$LATEST_BACKUP" ]; then
            sudo rm -rf "$FRONTEND_DIST_PATH"
            sudo mv "$LATEST_BACKUP" "$FRONTEND_DIST_PATH"
            sudo nginx -s reload
            log_warning "Rolled back to previous version"
        fi
        
        exit 1
    fi
    
    cd ..
fi

# Health check
log_info "Performing health checks..."

if [ "$DEPLOY_BACKEND" = true ]; then
    log_info "Checking backend health..."
    sleep 3  # Give the server time to start
    
    if curl -f -s http://localhost:4000/api/urls > /dev/null; then
        log_success "Backend is healthy!"
    else
        log_warning "Backend health check failed"
    fi
fi

if [ "$DEPLOY_FRONTEND" = true ]; then
    log_info "Checking frontend accessibility..."
    
    if curl -f -s -o /dev/null https://lk.ballchen.cc; then
        log_success "Frontend is accessible!"
    else
        log_warning "Frontend accessibility check failed"
    fi
fi

# Show PM2 status
if [ "$DEPLOY_BACKEND" = true ]; then
    log_info "PM2 status:"
    pm2 status $PM2_APP_NAME
fi

log_success "Deployment completed!"
log_info "Frontend: https://lk.ballchen.cc"
log_info "Backend API: https://lk-api.ballchen.cc"

# Clean up old backups (keep only last 5)
log_info "Cleaning up old backups..."
sudo find $(dirname "$FRONTEND_DIST_PATH") -name "dist.backup.*" -type d | sort | head -n -5 | sudo xargs rm -rf 2>/dev/null || true

log_success "All done! 🎉" 
#!/bin/bash

# Environment Check Script for LinkKeeper
# Verifies all required services and configurations

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[CHECK]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

ERRORS=0

log_info "Checking LinkKeeper environment..."

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    log_success "Node.js installed: $NODE_VERSION"
else
    log_error "Node.js is not installed"
    ERRORS=$((ERRORS + 1))
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    log_success "npm installed: $NPM_VERSION"
else
    log_error "npm is not installed"
    ERRORS=$((ERRORS + 1))
fi

# Check PM2
if command -v pm2 &> /dev/null; then
    log_success "PM2 installed"
    
    # Check if LinkKeeper is running
    if pm2 describe url-saver-server &> /dev/null; then
        log_success "LinkKeeper backend is running in PM2"
    else
        log_warning "LinkKeeper backend is not running in PM2"
    fi
else
    log_error "PM2 is not installed"
    ERRORS=$((ERRORS + 1))
fi

# Check nginx
if command -v nginx &> /dev/null; then
    log_success "nginx installed"
    
    # Test nginx configuration
    if sudo nginx -t &> /dev/null; then
        log_success "nginx configuration is valid"
    else
        log_error "nginx configuration has errors"
        ERRORS=$((ERRORS + 1))
    fi
else
    log_error "nginx is not installed"
    ERRORS=$((ERRORS + 1))
fi

# Check directories
if [ -d "/home/ball/project/linkeeper" ]; then
    log_success "Project directory exists"
    
    if [ -d "/home/ball/project/linkeeper/client/dist" ]; then
        log_success "Frontend dist directory exists"
    else
        log_warning "Frontend dist directory does not exist"
    fi
    
    if [ -d "/home/ball/project/linkeeper/server/dist" ]; then
        log_success "Backend dist directory exists"
    else
        log_warning "Backend dist directory does not exist"
    fi
else
    log_error "Project directory does not exist"
    ERRORS=$((ERRORS + 1))
fi

# Check server dependencies
log_info "Checking server environment..."
cd server 2>/dev/null || { log_error "Cannot access server directory"; ERRORS=$((ERRORS + 1)); }

if [ -f ".env" ]; then
    log_success "Server .env file exists"
    
    # Check for required environment variables
    if grep -q "MONGODB_URI" .env; then
        log_success "MONGODB_URI configured"
    else
        log_warning "MONGODB_URI not found in .env"
    fi
    
    if grep -q "TELEGRAM_BOT_TOKEN" .env; then
        log_success "TELEGRAM_BOT_TOKEN configured"
    else
        log_warning "TELEGRAM_BOT_TOKEN not found in .env"
    fi
    
    if grep -q "AWS_ACCESS_KEY_ID" .env; then
        log_success "AWS_ACCESS_KEY_ID configured"
    else
        log_warning "AWS_ACCESS_KEY_ID not found in .env"
    fi
    
    if grep -q "AWS_S3_BUCKET" .env; then
        log_success "AWS_S3_BUCKET configured"
    else
        log_warning "AWS_S3_BUCKET not found in .env"
    fi
else
    log_error "Server .env file does not exist"
    ERRORS=$((ERRORS + 1))
fi

# Check client environment
log_info "Checking client environment..."
cd ../client 2>/dev/null || { log_error "Cannot access client directory"; ERRORS=$((ERRORS + 1)); }

if [ -f ".env" ]; then
    log_success "Client .env file exists"
    
    if grep -q "VITE_API_BASE_URL" .env; then
        log_success "VITE_API_BASE_URL configured"
    else
        log_warning "VITE_API_BASE_URL not found in .env"
    fi
else
    log_warning "Client .env file does not exist (optional)"
fi

# Check ports
log_info "Checking port availability..."

if ss -tuln | grep -q ":4000 "; then
    log_success "Port 4000 is in use (backend)"
else
    log_warning "Port 4000 is not in use"
fi

if ss -tuln | grep -q ":80 "; then
    log_success "Port 80 is in use (nginx)"
else
    log_warning "Port 80 is not in use"
fi

if ss -tuln | grep -q ":443 "; then
    log_success "Port 443 is in use (nginx SSL)"
else
    log_warning "Port 443 is not in use"
fi

# Check SSL certificates
if [ -f "/etc/letsencrypt/live/lk-api.ballchen.cc/fullchain.pem" ]; then
    log_success "SSL certificate exists for lk-api.ballchen.cc"
else
    log_error "SSL certificate missing for lk-api.ballchen.cc"
    ERRORS=$((ERRORS + 1))
fi

# Summary
echo ""
log_info "Environment check completed"

if [ $ERRORS -eq 0 ]; then
    log_success "All critical checks passed! ✨"
    exit 0
else
    log_error "Found $ERRORS critical issues that need attention"
    exit 1
fi 
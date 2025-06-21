# LinkKeeper Makefile
# Simplifies common deployment and management tasks

.PHONY: help install build deploy deploy-quick deploy-frontend deploy-backend start stop restart status logs clean check

# Default target
help:
	@echo "LinkKeeper Deployment Commands:"
	@echo ""
	@echo "Setup & Installation:"
	@echo "  make install       - Install dependencies for both frontend and backend"
	@echo "  make check         - Check environment and configuration"
	@echo ""
	@echo "Build Commands:"
	@echo "  make build         - Build both frontend and backend"
	@echo "  make build-frontend - Build only frontend"
	@echo "  make build-backend  - Build only backend"
	@echo ""
	@echo "Deployment Commands:"
	@echo "  make deploy        - Full deployment with safety checks"
	@echo "  make deploy-quick  - Quick deployment without extensive checks"
	@echo "  make deploy-frontend - Deploy only frontend"
	@echo "  make deploy-backend  - Deploy only backend"
	@echo ""
	@echo "Service Management:"
	@echo "  make start         - Start all services"
	@echo "  make stop          - Stop all services"
	@echo "  make restart       - Restart all services"
	@echo "  make status        - Show service status"
	@echo "  make logs          - Show backend logs"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean         - Clean build artifacts"
	@echo "  make backup        - Create backup of current deployment"
	@echo "  make reanalyze     - Re-analyze all URLs and upload images to S3"
	@echo "  make health        - Perform health check on all services"

# Setup and installation
install:
	@echo "📦 Installing dependencies..."
	cd server && npm install
	cd client && npm install
	@echo "✅ Dependencies installed!"

check:
	@echo "🔍 Checking environment..."
	@chmod +x check-env.sh
	@./check-env.sh

# Build commands
build: build-backend build-frontend
	@echo "✅ Build completed!"

build-frontend:
	@echo "🏗️ Building frontend..."
	cd client && npm run build

build-backend:
	@echo "🏗️ Building backend..."
	cd server && npm run build

# Deployment commands
deploy:
	@echo "🚀 Starting full deployment..."
	@chmod +x deploy.sh
	@./deploy.sh

deploy-quick:
	@echo "⚡ Starting quick deployment..."
	@chmod +x quick-deploy.sh
	@./quick-deploy.sh

deploy-frontend:
	@echo "🎨 Deploying frontend only..."
	@chmod +x deploy.sh
	@./deploy.sh --frontend-only

deploy-backend:
	@echo "⚙️ Deploying backend only..."
	@chmod +x deploy.sh
	@./deploy.sh --backend-only

# Service management
start:
	@echo "▶️ Starting services..."
	cd server && pm2 start ecosystem.config.js --env production
	sudo systemctl start nginx

stop:
	@echo "⏹️ Stopping services..."
	pm2 stop url-saver-server || true
	sudo systemctl stop nginx || true

restart:
	@echo "🔄 Restarting services..."
	pm2 restart url-saver-server || pm2 start server/ecosystem.config.js --env production
	sudo nginx -s reload

status:
	@echo "📊 Service status:"
	@echo ""
	@echo "PM2 Status:"
	@pm2 status url-saver-server || echo "PM2 service not running"
	@echo ""
	@echo "Nginx Status:"
	@sudo systemctl status nginx --no-pager -l || echo "Nginx status unavailable"
	@echo ""
	@echo "Port Status:"
	@ss -tuln | grep -E ":(4000|80|443) " || echo "No services found on expected ports"

logs:
	@echo "📋 Backend logs:"
	pm2 logs url-saver-server --lines 50

# Maintenance
clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf server/dist
	rm -rf client/dist
	rm -rf server/node_modules/.cache
	rm -rf client/node_modules/.cache
	@echo "✅ Clean completed!"

backup:
	@echo "💾 Creating backup..."
	@mkdir -p backups
	@tar -czf backups/linkeeper-backup-$(shell date +%Y%m%d_%H%M%S).tar.gz \
		server/dist client/dist server/.env client/.env.local 2>/dev/null || \
		tar -czf backups/linkeeper-backup-$(shell date +%Y%m%d_%H%M%S).tar.gz \
		server/dist client/dist 2>/dev/null || true
	@echo "✅ Backup created in backups/ directory"

# Development helpers
dev-backend:
	@echo "🔧 Starting backend in development mode..."
	cd server && npm run dev

dev-frontend:
	@echo "🔧 Starting frontend in development mode..."
	cd client && npm run dev

# Health check
health:
	@echo "🏥 Performing health check..."
	@curl -f -s http://localhost:4000/api/urls > /dev/null && echo "✅ Backend healthy" || echo "❌ Backend unhealthy"
	@curl -f -s https://lk.ballchen.cc > /dev/null && echo "✅ Frontend accessible" || echo "❌ Frontend inaccessible"
	@curl -f -s https://lk-api.ballchen.cc/api/urls > /dev/null && echo "✅ API accessible" || echo "❌ API inaccessible"

# Data management
reanalyze:
	@echo "🔄 Re-analyzing all URLs and uploading images to S3..."
	cd server && npm run reanalyze

reanalyze-build:
	@echo "🔄 Building and re-analyzing all URLs..."
	cd server && npm run build && npm run reanalyze 
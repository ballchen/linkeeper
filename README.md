# 📎 URL Saver System

A comprehensive system that consists of a Telegram bot and a website to save and display URLs with intelligent source detection and tagging capabilities.

## ✨ Features

- 🤖 **Telegram Bot**: Listen to messages and save URLs automatically
- 🌐 **Web Interface**: Display saved URLs with beautiful previews
- 🔍 **Smart Source Detection**: Automatically detect URLs from Facebook, Instagram, Threads, and YouTube
- 🏷️ **Tag Support**: Add custom tags to organize your URLs
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🔄 **Real-time Updates**: Automatically refresh URL list
- 🖼️ **Rich URL Previews**: Show title, description, images, source badges, and tags
- 🏗️ **Clean Architecture**: Well-structured codebase following Clean Architecture principles

## 🎯 Supported Platforms

The system automatically detects URLs from the following platforms:

- **Facebook**: Posts, videos, photos, events
- **Instagram**: Posts, reels, stories, IGTV
- **Threads**: Posts
- **YouTube**: Videos, Shorts, playlists, channels

When a URL from these platforms is detected, it's automatically tagged with the appropriate source.

## 🛠️ Tech Stack

### Backend (Server)
- **TypeScript** - Type-safe JavaScript
- **Express.js** - Web framework
- **MongoDB** - Database for storing URLs
- **Telegraf** - Telegram bot framework
- **Cheerio** - Web scraping for URL metadata
- **Axios** - HTTP client
- **Clean Architecture** - Domain-driven design pattern

### Frontend (Client)
- **React** - UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool
- **Axios** - HTTP client for API calls

## 🚀 Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- Telegram Bot Token (from @BotFather)

### 1. Clone and Install Dependencies

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Environment Setup

Create a `.env` file in the `server` directory:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
MONGODB_URI=mongodb://localhost:27017/url-saver
PORT=4000
API_URL=http://localhost:4000/api/urls
```

### 3. Get Telegram Bot Token

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` command
3. Follow the instructions to create your bot
4. Copy the bot token and add it to your `.env` file

### 4. Start MongoDB

Make sure MongoDB is running on your system:

```bash
# If using local MongoDB
mongod

# Or if using MongoDB service
sudo systemctl start mongod
```

### 5. Run the Application

#### Start the Server (Backend + Telegram Bot)
```bash
cd server
npm run dev
```

#### Start the Client (React App)
```bash
cd client
npm run dev
```

The web interface will be available at `http://localhost:5173`

## 📱 Usage

1. **Start the Telegram Bot**: Send `/start` to your bot in Telegram
2. **Send URLs**: Send any URL to the bot, and it will be saved automatically with source detection
3. **View URLs**: Open the web interface to see all saved URLs with:
   - Rich previews with images
   - Source badges (Facebook, Instagram, Threads, YouTube)
   - Custom tags
   - Organized metadata
4. **Refresh**: Click the refresh button or wait for automatic updates

## 🔧 API Endpoints

### Add URL with Tags
```http
POST /api/urls
Content-Type: application/json

{
  "url": "https://www.youtube.com/shorts/abc123",
  "tags": ["youtube", "shorts", "entertainment"]
}
```

### Add URL from shared text (iOS share sheet)
```http
POST /api/urls
Authorization: Bearer lkd_...
Content-Type: application/json

{
  "text": "看看這個 https://www.instagram.com/reel/abc/?igsh=xyz",
  "metadata": {
    "title": "og:title read on the device",
    "description": "og:description",
    "image": "https://cdn.example.com/og-image.jpg"
  }
}
```

`metadata` is optional and treated as a hint: invalid fields are ignored rather than failing the request. Device-provided values take priority over server scraping (useful for sites that block server-side crawlers, e.g. Instagram/Facebook); when both title and image are provided the server skips scraping and only uploads the image to S3.

New URLs are saved immediately with `"status": "pending"` and return `201`; title, description and preview image are fetched in the background and the status becomes `ready`. Tracking parameters (`utm_*`, `igsh`, `fbclid`, YouTube `si`, ...) are stripped so the same link isn't saved twice (`200` with `"isNew": false`).

### Update Tags
```http
PATCH /api/urls/:id
Content-Type: application/json

{ "tags": ["read-later"] }
```

### Re-fetch Metadata
```http
POST /api/urls/:id/refresh
```

Puts the URL back to `pending` and queues it for metadata fetching again (`202`). Used by the iOS app's "重新抓取" button.

### Device Tokens (iOS app / Share Extension)
Long-lived, revocable tokens for clients that can't refresh a 7-day JWT on their own. Managing them requires a JWT.

```http
POST   /api/auth/devices        { "name": "iPhone" }   → { "token": "lkd_...", "device": {...} } (token shown once)
GET    /api/auth/devices
DELETE /api/auth/devices/:id
```

Use the token as `Authorization: Bearer lkd_...` on `/api/urls`.

### Get All URLs
```http
GET /api/urls
GET /api/urls?limit=30&cursor=...&search=...&source=youtube   # paginated; source=other means no detected platform
```

Returns URLs with source detection and tags:
```json
{
  "id": "507f1f77bcf86cd799439011",
  "url": "https://www.youtube.com/shorts/abc123",
  "title": "Amazing Short Video",
  "description": "Check out this amazing short video",
  "image": "https://example.com/thumbnail.jpg",
  "source": "youtube",
  "tags": ["youtube", "shorts", "entertainment"],
  "createdAt": "2023-12-07T10:30:00.000Z"
}
```

## 📲 iOS App

The `ios/` folder contains the SwiftUI app and Share Extension. See [ios/README.md](ios/README.md) for setup.

## 📁 Project Structure (Clean Architecture)

```
├── server/                     # Backend application
│   ├── src/
│   │   ├── application/        # Application layer (Use Cases)
│   │   ├── domain/             # Domain layer (Entities, Services, Repositories)
│   │   │   ├── entities/       # Domain entities
│   │   │   ├── repositories/   # Repository interfaces
│   │   │   └── services/       # Domain services
│   │   ├── infrastructure/     # Infrastructure layer
│   │   │   ├── config/         # Dependency injection
│   │   │   ├── database/       # MongoDB implementations
│   │   │   ├── services/       # Service implementations
│   │   │   └── web/            # Controllers and routes
│   │   ├── bot/                # Telegram bot
│   │   ├── middleware/         # Express middleware
│   │   ├── utils/              # Utilities
│   │   └── index.ts            # Server entry point
│   └── package.json
├── client/                     # Frontend application
│   ├── src/
│   │   ├── App.tsx            # Main React component with source badges
│   │   ├── App.css            # Styles with tag and badge support
│   │   └── main.tsx           # React entry point
│   └── package.json
└── README.md
```

## 🧪 Testing

### Unit Tests
```bash
cd server
npm test           # run once
npm run test:watch # watch mode
npm run typecheck  # type-check src + tests
```

### Test URL Analysis
```bash
cd server
npm run build
node dist/test-youtube-analysis.js
```

### Test API with Different Platforms
Use the provided `server/test-api.http` file to test various URL types:
- Facebook posts and videos
- Instagram posts and reels
- YouTube videos and shorts
- Threads posts

## 🎨 Features Showcase

### Smart Source Detection
- 📘 **Facebook**: Detects posts, videos, photos, events
- 📷 **Instagram**: Identifies posts, reels, stories, IGTV
- 🧵 **Threads**: Recognizes posts
- 📹 **YouTube**: Categorizes videos, shorts, playlists, channels

### Tag Management
- Add custom tags when saving URLs
- Visual tag display with color variations
- Organize content by topic or category

### Beautiful UI
- Source badges with platform colors
- Interactive tag pills
- Responsive card layout
- Smooth animations and transitions

## 🛠️ Development

### Server Development
```bash
cd server
npm run dev    # Start with hot reload
npm run build  # Build TypeScript
npm start      # Start production build
```

### Client Development
```bash
cd client
npm run dev     # Start development server
npm run build   # Build for production
npm run preview # Preview production build
```

## 🔧 Troubleshooting

### Common Issues

1. **Bot not responding**: Check if the bot token is correct and the server is running
2. **Database connection error**: Ensure MongoDB is running and the connection string is correct
3. **CORS errors**: Make sure both server and client are running on the specified ports
4. **URL previews not loading**: Some websites may block scraping; this is normal
5. **Source not detected**: Currently supports Facebook, Instagram, Threads, and YouTube URLs

### Logs

Check the server console for detailed error messages and bot activity logs.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the MIT License. 
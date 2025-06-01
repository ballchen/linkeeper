# LinkKeeper Security Configuration

## API Authentication

The LinkKeeper server implements API key authentication to protect the URL creation endpoint from unauthorized access.

### Protected Endpoints

- `POST /api/urls` - Protected with API key authentication (used by Telegram bot)

### Public Endpoints  

- `GET /api/urls` - Public endpoint (used by frontend)

### Environment Variables Required

```bash
# Generate a secure random API key for production
INTERNAL_API_KEY=your_secure_random_key_here
```

### API Key Usage

The Telegram bot automatically includes the API key in requests using the `Authorization` header:

```
Authorization: Bearer your_api_key_here
```

Alternative header format is also supported:
```
x-api-key: your_api_key_here
```

### Generating a Secure API Key

For production, generate a secure random API key:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using OpenSSL
openssl rand -hex 32

# Using Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### Security Features

1. **API Key Validation**: All POST requests to `/api/urls` require valid API key
2. **Request Logging**: All authentication attempts are logged with IP addresses
3. **Error Handling**: Detailed error responses for debugging while maintaining security
4. **Environment Isolation**: API keys are stored in environment variables, not in code

### Setup Instructions

1. Copy `.env.example` to `.env`
2. Generate a secure API key using one of the methods above
3. Set `INTERNAL_API_KEY` in your `.env` file
4. Restart the server
5. The Telegram bot will automatically use the API key for authentication 
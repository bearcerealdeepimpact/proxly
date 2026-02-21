# SSL Certificates Directory

This directory is used by nginx for HTTPS/WSS support.

## Development/Testing

For local development without HTTPS, this directory can remain empty. The nginx HTTP server (port 80) will work without SSL certificates.

## Production Deployment

For production deployment with HTTPS, place your SSL certificate files here:

- `cert.pem` - SSL certificate (or `fullchain.pem` for Let's Encrypt)
- `key.pem` - Private key (or `privkey.pem` for Let's Encrypt)

### Option 1: Let's Encrypt (Recommended)

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot

# Stop nginx temporarily
docker-compose stop nginx

# Generate certificates
sudo certbot certonly --standalone -d yourdomain.com

# Copy certificates to ssl directory
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./ssl/key.pem
sudo chmod 644 ./ssl/cert.pem ./ssl/key.pem

# Restart nginx
docker-compose up -d nginx
```

### Option 2: Self-Signed Certificate (Testing Only)

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem \
  -out ssl/cert.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=yourdomain.com"
```

**Note:** Self-signed certificates will show browser warnings and are not recommended for production.

### Option 3: Commercial SSL Certificate

If you purchased an SSL certificate from a certificate authority:

1. Download your certificate files from your provider
2. Copy `certificate.crt` to `./ssl/cert.pem`
3. Copy `private.key` to `./ssl/key.pem`
4. Ensure proper file permissions (644 for cert, 600 for key)

## Security Notes

- **Never commit SSL private keys to version control**
- The `ssl/` directory is excluded in `.gitignore` (except this README)
- Restrict file permissions: `chmod 600 ssl/key.pem`
- Rotate certificates before expiration (Let's Encrypt: every 90 days)

## Troubleshooting

### nginx fails to start
- Check that both `cert.pem` and `key.pem` exist
- Verify file permissions allow nginx to read them
- Check nginx logs: `docker-compose logs nginx`

### Browser shows certificate warnings
- Verify certificate matches your domain name
- Check certificate expiration date
- Ensure certificate chain is complete (use `fullchain.pem` for Let's Encrypt)

## File Structure

```
ssl/
├── README.md          # This file (tracked in git)
├── cert.pem          # SSL certificate (ignored by git)
└── key.pem           # Private key (ignored by git)
```

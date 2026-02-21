# Music Club

A local multiplayer browser game where players walk around a virtual music club together in real-time. Built with minimal dependencies (just Express and WebSocket), Music Club offers a stable, lightweight alternative to buggy virtual gathering platforms.

## Features

- **Real-time Multiplayer**: Walk around and interact with other players in a shared virtual space
- **Synchronized Music**: Everyone hears the same music at the same time across all connected clients
- **Character Selection**: Choose from 6 different character sprites
- **Interactive Objects**: Order drinks, carry them around, and kick them across the floor
- **Minimal Dependencies**: Only 2 production dependencies (Express + ws) for maximum stability
- **WebSocket Communication**: Real-time updates with automatic protocol detection (ws:// or wss://)

## Prerequisites

### For Local Development
- Node.js 18+ (LTS recommended)
- npm (comes with Node.js)

### For Docker Deployment
- Docker 20.10+
- Docker Compose 2.0+
- A VPS or cloud server (recommended: 1GB RAM, 1 CPU)
- A domain name (required for HTTPS/WSS)

## Local Development

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd music-club
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Open your browser**
   ```
   http://localhost:3000
   ```

The server will start on port 3000 by default. You can customize this with the `PORT` environment variable:

```bash
PORT=8080 npm start
```

## Docker Deployment

### Quick Deployment (HTTP Only)

For quick testing without HTTPS:

```bash
# Start the application
docker-compose up -d

# Check the status
docker ps

# View logs
docker-compose logs -f

# Access the app
# Open http://your-server-ip in your browser
```

### Production Deployment with HTTPS

For production deployment with HTTPS and secure WebSocket (WSS), follow these steps:

#### Step 1: Obtain SSL Certificates

**Option A: Let's Encrypt (Recommended)**

1. **Install Certbot** on your server:
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install certbot

   # CentOS/RHEL
   sudo yum install certbot
   ```

2. **Stop nginx if running**:
   ```bash
   docker-compose down
   ```

3. **Obtain certificate** (standalone mode):
   ```bash
   sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com
   ```

4. **Copy certificates to project**:
   ```bash
   # Create SSL directory
   mkdir -p ssl

   # Copy certificates
   sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/cert.pem
   sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/key.pem

   # Set proper permissions
   sudo chown $USER:$USER ssl/*.pem
   chmod 644 ssl/cert.pem
   chmod 600 ssl/key.pem
   ```

**Option B: Self-Signed Certificate (Development/Testing Only)**

```bash
mkdir -p ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem \
  -out ssl/cert.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=your-domain.com"
```

⚠️ **Warning**: Self-signed certificates will show security warnings in browsers and are NOT recommended for production.

#### Step 2: Configure Domain DNS

Point your domain's DNS A record to your server's IP address:

```
A    @              your-server-ip
A    www            your-server-ip
```

Wait for DNS propagation (can take up to 48 hours, usually much faster).

#### Step 3: Enable HTTPS Redirect (Optional)

Edit `nginx/nginx.conf` and uncomment line 39 to force HTTPS:

```nginx
# Uncomment this line:
return 301 https://$host$request_uri;
```

#### Step 4: Update nginx Server Name

Edit `nginx/nginx.conf` and replace `server_name _;` with your domain:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    # ...
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;
    # ...
}
```

#### Step 5: Start the Application

```bash
# Start all services
docker-compose up -d

# Verify containers are running
docker ps

# Check logs
docker-compose logs -f nginx
docker-compose logs -f app

# Test health endpoint
curl https://your-domain.com/health
```

#### Step 6: Set Up Certificate Auto-Renewal

Let's Encrypt certificates expire after 90 days. Set up automatic renewal:

```bash
# Test renewal
sudo certbot renew --dry-run

# Add cron job for automatic renewal
sudo crontab -e

# Add this line (runs twice daily):
0 0,12 * * * certbot renew --quiet --deploy-hook "docker-compose -f /path/to/music-club/docker-compose.yml restart nginx"
```

Make sure to replace `/path/to/music-club` with your actual project path.

## Environment Variables

Configuration is managed through environment variables. See `.env.example` for all available options.

### Available Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Port the server listens on | `3000` | No |
| `NODE_ENV` | Node environment (development/production/test) | `production` | No |
| `HOST` | Host to bind to | `0.0.0.0` | No |

### Using Environment Variables

**Docker Compose** (recommended):

Edit `docker-compose.yml` and update the `environment` section:

```yaml
services:
  app:
    environment:
      - NODE_ENV=production
      - PORT=3000
```

**Local Development**:

```bash
# Create .env file
cp .env.example .env

# Edit .env with your values
nano .env

# Start with environment variables
npm start
```

**Command Line**:

```bash
PORT=8080 NODE_ENV=development npm start
```

## Health Check

The application includes a health check endpoint for monitoring:

```bash
# Local
curl http://localhost:3000/health

# Production (HTTP)
curl http://your-domain.com/health

# Production (HTTPS)
curl https://your-domain.com/health
```

Expected response:
```json
{"status":"ok"}
```

### Docker Health Check

The Docker container includes an automatic health check that runs every 30 seconds. Check container health:

```bash
# View container health status
docker ps

# Detailed health check info
docker inspect music-club-app | grep -A 10 Health
```

## Architecture

### Components

- **Node.js Application** (`app` service): Express server with WebSocket support
- **Nginx Reverse Proxy** (`nginx` service): Handles HTTPS termination and WebSocket proxying
- **Docker Network**: Isolated bridge network for secure container communication

### Ports

- **80**: HTTP (redirects to HTTPS in production)
- **443**: HTTPS with WSS (WebSocket Secure)
- **3000**: Application port (internal, not exposed)

### WebSocket Support

The client automatically detects the protocol and uses:
- `ws://` for HTTP connections
- `wss://` for HTTPS connections

No client-side configuration needed!

## Troubleshooting

### WebSocket Connection Failures

**Symptom**: Players can't see each other, connection fails

**Solutions**:

1. **Check container status**:
   ```bash
   docker ps
   docker-compose logs app
   ```

2. **Verify health endpoint**:
   ```bash
   curl http://localhost/health
   ```

3. **Check WebSocket upgrade headers** (nginx logs):
   ```bash
   docker-compose logs nginx | grep Upgrade
   ```

4. **Firewall issues**: Ensure ports 80 and 443 are open:
   ```bash
   # Ubuntu/Debian
   sudo ufw allow 80
   sudo ufw allow 443

   # CentOS/RHEL
   sudo firewall-cmd --permanent --add-service=http
   sudo firewall-cmd --permanent --add-service=https
   sudo firewall-cmd --reload
   ```

### HTTPS Certificate Issues

**Symptom**: "Your connection is not private" or certificate errors

**Solutions**:

1. **Verify certificates exist**:
   ```bash
   ls -la ssl/
   # Should show cert.pem and key.pem
   ```

2. **Check certificate expiration**:
   ```bash
   openssl x509 -in ssl/cert.pem -noout -enddate
   ```

3. **Verify certificate chain**:
   ```bash
   openssl verify -CAfile ssl/cert.pem ssl/cert.pem
   ```

4. **Renew expired certificate**:
   ```bash
   sudo certbot renew
   # Copy new certificates to ssl/ directory
   docker-compose restart nginx
   ```

### Container Won't Start

**Symptom**: `docker-compose up` fails or container exits immediately

**Solutions**:

1. **Check logs**:
   ```bash
   docker-compose logs app
   docker-compose logs nginx
   ```

2. **Verify nginx configuration**:
   ```bash
   docker run --rm -v "$PWD/nginx/nginx.conf:/etc/nginx/nginx.conf:ro" nginx:alpine nginx -t
   ```

3. **Check port conflicts**:
   ```bash
   # See what's using port 80
   sudo lsof -i :80

   # See what's using port 443
   sudo lsof -i :443
   ```

4. **Rebuild containers**:
   ```bash
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```

### High Memory/CPU Usage

**Symptom**: Server becomes slow or unresponsive

**Solutions**:

1. **Check resource usage**:
   ```bash
   docker stats
   ```

2. **Restart containers**:
   ```bash
   docker-compose restart
   ```

3. **Check number of connections**:
   ```bash
   docker-compose logs app | grep "connection"
   ```

4. **Increase server resources** if consistently high (recommended: 2GB RAM for 50+ concurrent users)

### Players Not Syncing

**Symptom**: Music out of sync or players don't see each other's movements

**Solutions**:

1. **Check WebSocket connection** in browser console (F12):
   ```
   Should see: "Connected to server"
   Should NOT see: Connection errors or repeated reconnection attempts
   ```

2. **Verify server time sync**:
   ```bash
   # On server
   timedatectl status

   # If time is wrong, sync it
   sudo timedatectl set-ntp true
   ```

3. **Check network latency**:
   ```bash
   # From client machine
   ping your-domain.com
   ```

4. **Restart application**:
   ```bash
   docker-compose restart app
   ```

### Checking Logs

View real-time logs:

```bash
# All services
docker-compose logs -f

# Just the app
docker-compose logs -f app

# Just nginx
docker-compose logs -f nginx

# Last 100 lines
docker-compose logs --tail=100
```

## Monitoring

### Production Monitoring

For production environments, consider setting up monitoring:

1. **Uptime monitoring**: Use services like UptimeRobot or Pingdom to check `/health`
2. **Log aggregation**: Forward Docker logs to services like Papertrail or Loggly
3. **Resource monitoring**: Use Docker stats or tools like Prometheus + Grafana

### Simple Health Check Script

Create a simple monitoring script:

```bash
#!/bin/bash
# health-check.sh

HEALTH_URL="https://your-domain.com/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -eq 200 ]; then
    echo "✓ Health check passed"
    exit 0
else
    echo "✗ Health check failed (HTTP $RESPONSE)"
    # Optionally restart containers
    # docker-compose restart
    exit 1
fi
```

Run it periodically with cron:

```bash
# Check every 5 minutes
*/5 * * * * /path/to/health-check.sh >> /var/log/music-club-health.log 2>&1
```

## Performance

### Recommended Server Specs

| Users | RAM | CPU | Bandwidth |
|-------|-----|-----|-----------|
| 1-10 | 512MB | 1 core | 10 Mbps |
| 10-50 | 1GB | 1 core | 25 Mbps |
| 50-100 | 2GB | 2 cores | 50 Mbps |
| 100+ | 4GB+ | 2+ cores | 100+ Mbps |

### Optimization Tips

- **Use HTTP/2**: Already enabled in nginx configuration
- **Enable gzip**: Already enabled for static assets
- **Use a CDN**: Consider Cloudflare for static asset caching
- **Monitor connections**: WebSocket connections stay open, monitor with `docker stats`

## Security

### Production Checklist

- [ ] HTTPS enabled with valid SSL certificate
- [ ] Firewall configured (only ports 80, 443, and SSH open)
- [ ] Regular security updates (`apt update && apt upgrade`)
- [ ] Strong SSH key authentication (disable password login)
- [ ] Automatic SSL certificate renewal configured
- [ ] Docker containers run as non-root user (already configured)
- [ ] Security headers enabled in nginx (already configured)
- [ ] Regular backups of configuration files

### Updating

Keep the application and dependencies updated:

```bash
# Pull latest changes
git pull

# Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Or update dependencies
npm update
docker-compose build
docker-compose up -d
```

## License

ISC

## Support

For issues, questions, or contributions, please open an issue on the project repository.

---

**Built with ❤️ and minimal dependencies**

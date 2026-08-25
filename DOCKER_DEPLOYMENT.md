# HAL Procurement Portal — Docker Deployment Guide

This setup completely dockerizes the **HAL Procurement Portal** (PostgreSQL database, Node.js backend API, and React frontend served via Nginx) into self-contained containers.

With a single command, Docker will:
1. Initialize the PostgreSQL 16 database.
2. Build the React SPA into production static assets.
3. Install backend dependencies and run database schema migrations & master seeds automatically.
4. Launch the Nginx web server with API reverse proxying on Port 80.
5. Persist database tables and uploaded attachments across container restarts.

---

## 1. Quick Start (Online or Pre-loaded Host)

Run the following command from the project root directory:

```bash
docker compose up --build -d
```

That's it! Open your browser and navigate to:
```
http://localhost
```
*(Or `http://<server-lan-ip>` from any workstation connected to the same LAN).*

---

## 2. Default Test Credentials

All seeded accounts share the password **`hal@1234`**.

| Email | Role | Access Scope |
|---|---|---|
| `admin@hal.local` | Admin | Full Access + Live Role Switcher |
| `test@hal.local` | QA Admin | Full Access + Live Role Switcher |
| `maker@hal.local` | Purchase Maker | RV Inbox, Payment Advice, Register |
| `officer@hal.local` | Purchase Officer | Forward Advice, Register |
| `desk@hal.local` | Payment Desk | Process Payment, Register |
| `hod@hal.local` | HOD (IMM) | HOD Approval, Register |
| `gm@hal.local` | GM (AOD) | Division-wide supervision |
| `cm@hal.local` | CM (Purchase) | Direct Head + Top-secret participant |

---

## 3. Useful Docker Management Commands

- **Check container status**:
  ```bash
  docker compose ps
  ```

- **View live server & migration logs**:
  ```bash
  docker compose logs -f
  ```

- **View backend server logs specifically**:
  ```bash
  docker compose logs -f server
  ```

- **Stop all services**:
  ```bash
  docker compose down
  ```

- **Stop and remove all data volumes (Reset to fresh state)**:
  ```bash
  docker compose down -v
  ```

---

## 4. Air-Gapped / Offline LAN Server Deployment

If the target LAN server has **no internet connectivity**:

### Step 1: On an Internet-Connected Machine
Build and save the Docker images to a tar file:
```bash
# Build the images
docker compose build

# Save images to a tar archive
docker save -o hal_procurement_images.tar postgres:16-alpine hal_procurement_portal-server hal_procurement_portal-client
```

### Step 2: On the Offline LAN Server
Transfer `hal_procurement_images.tar` and `docker-compose.yml` (via USB / internal storage) to the server, then load and run:
```bash
# Load images into offline Docker engine
docker load -i hal_procurement_images.tar

# Start the application without rebuilding
docker compose up -d
```

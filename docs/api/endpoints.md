# MargDrishti — REST API Specification (Phase 2 Blueprint)

---

## Authentication Endpoints

### `POST /api/v1/auth/signup`
- **Request:** `{ "name", "email", "mobile", "password", "role": "citizen"|"authority", "roadType"?, "jurisdiction"? }`
- **Response:** `{ "success": true, "user": { "id": "CIT-2026-000001", "name", "email", "role" }, "token": "JWT..." }`

### `POST /api/v1/auth/login`
- **Request:** `{ "email", "password", "role" }`
- **Response:** `{ "token", "refreshToken", "user" }`

---

## Complaint Endpoints

### `GET /api/v1/complaints`
- **Parameters:** `?status=...&priority=...&bbox=...&roadType=...`
- **Response:** Array of complaint records with PostGIS geo coordinates.

### `POST /api/v1/complaints`
- **Request:** Multi-part with image/video file, coordinates, road type, jurisdiction, damage description, and hardware sensor telemetry.
- **Response:** `{ "complaintId": "MD-2026-000001", "status": "REPORTED", "priority": { "score": 88 } }`

### `PUT /api/v1/complaints/{id}/verify`
- Marks complaint jurisdiction verified.

### `PUT /api/v1/complaints/{id}/assign`
- Dispatches complaint to designated field engineer. Starts 15-day cooldown timer.

### `PUT /api/v1/complaints/{id}/start-progress`
- Validates 15-day cooldown before allowing work to begin.

### `PUT /api/v1/complaints/{id}/repair-complete`
- Caps resolution at 90% and activates 60-day post-repair monitoring period.

### `PUT /api/v1/complaints/{id}/confirm-final`
- Official closure with 100% Fully Resolved status.

---

## Routing & GIS Endpoints

### `POST /api/v1/routing/calculate`
- **Request:** `{ "source": [lat, lon], "destination": [lat, lon], "mode": "SAFEST"|"FASTEST"|"BALANCED" }`
- **Response:** Array of routes with distance, estimated time, active pothole counts, high-severity counts, density, safety score, and recommended corridor.

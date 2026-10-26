# ExamMatrix - Requirements
# This is a Node.js project. The real dependency list is backend/package.json,
# installed with "npm install". This file lists everything needed to run it.

# ---------- Runtime ----------
node>=20
npm>=10

# ---------- Backend dependencies (backend/package.json) ----------
express@^5.3.0          # web server and routing
mongoose@^9.11.3        # MongoDB models and queries
jsonwebtoken@^9.0.3     # login tokens (JWT)
bcrypt@^6.0.0           # password hashing
multer@^2.5.0           # receiving uploaded files
xlsx@^0.18.5            # reading Excel files
nodemailer@^10.2.1      # sending verification and reset emails
helmet@^8.3.0           # security headers
cors@^2.8.6             # lets the frontend call the API
dotenv@^18.0.9          # loads settings from backend/.env

# ---------- Dev dependencies ----------
nodemon@^3.1.14         # restarts the server on save (npm run dev)

# ---------- Services ----------
# MongoDB Atlas (cloud database)  -> MONGO_URI in backend/.env
# SMTP email account (optional)   -> SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM
#                                    without it, emails are printed in the terminal

# ---------- Frontend ----------
# No packages. Plain HTML, CSS and JavaScript.
# Open with VS Code Live Server (or any static server).

# ---------- Setup ----------
# cd backend
# npm install
# cp .env.example .env      (then fill in the values)
# npm run dev               -> http://localhost:5001/api/health
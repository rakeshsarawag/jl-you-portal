# ⚡ Quick Reference Card

One-page reference for Portal Jeshan Labs

---

## 🚀 Start Command

```bash
pnpm dev
```

Open: **http://localhost:5173**

---

## 🔐 Login Credentials

**Admin (Full Access):**
- **Email:** `rakesh.sarawag@jeshanlabs.com`
- **Password:** `admin123`
- **Roles:** All 8 roles

**Employee (Limited Access):**
- **Email:** `employee@jeshanlabs.com`
- **Password:** `employee123`
- **Roles:** employee

**OTP Demo Code:** `123456`

---

## 📦 npm Commands

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start dev server |
| `pnpm build` | Build for production |
| `pnpm preview` | Preview production build |

---

## 🗂️ Project Structure

```
/src/app/
├── App.tsx              # Main app
├── routes.tsx           # Protected routes
├── components/          # 26 apps + UI
├── hooks/               # Data hooks
├── services/            # Business logic
└── utils/              # Utilities

/utils/supabase/
└── info.tsx            # Supabase config

/docs/                  # Documentation
```

---

## 🎯 26 Applications

### HR & People (8)
1. On Boarding Portal
2. Employee Dashboard
3. Recruitment Tracker
4. Performance Tracker
5. Payroll Management
6. Training Tracker
7. Employee Directory
8. OKR Management

### Operations (6)
9. IT Services
10. Asset Management
11. Project Management
12. Master Data Management
13. Communications Hub
14. Knowledge Base

### Finance (1)
15. Invoice Generation

### Marketing (1)
16. LinkedIn Post Manager

### Admin & Security (3)
17. User Management
18. Permission Manager
19. Security & Compliance

### Analytics & Advanced (7)
20. Executive Dashboard
21. Advanced Analytics
22. Workflow Automation
23. AI Intelligence Center
24. Collaboration Hub
25. Advanced Features
26. User Documentation

---

## 🔒 8 Role Types

| Role | Access Level |
|------|-------------|
| **admin** | All 26 apps |
| **hr** | HR, onboarding, recruitment, training, payroll |
| **finance** | Invoices, payroll, budgets, expenses |
| **manager** | Performance, projects, OKRs, teams |
| **employee** | Dashboard, directory, knowledge base, IT |
| **it** | IT services, asset management |
| **marketing** | LinkedIn posts, communications |
| **developer** | Projects, knowledge base |

---

## 🛠️ Common Tasks

### Create New User
1. Login as admin
2. Open "User Management"
3. Click "Add User"
4. Fill form and assign roles
5. Save

### Assign Permissions
1. Login as admin
2. Open "Permission Manager"
3. Find user
4. Toggle roles
5. Save changes

### Test Security
1. Login and open app
2. Bookmark page
3. Remove required role
4. Click bookmark
5. Should be denied ✅

---

## 📚 Documentation

| File | Purpose |
|------|---------|
| [START_HERE.md](START_HERE.md) | 5-minute quick start |
| [setup/SETUP_GUIDE.md](setup/SETUP_GUIDE.md) | Complete setup guide |
| [SECURITY_FEATURES.md](SECURITY_FEATURES.md) | Security architecture |
| [ROADMAP.md](ROADMAP.md) | Feature roadmap |
| [README.md](../README.md) | Project overview |

---

## 🐛 Quick Fixes

### Port in use:
```bash
lsof -ti:5173 | xargs kill -9
```

### Module errors:
```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Clear cache:
```bash
rm -rf node_modules/.vite
pnpm dev
```

---

## 🔍 Browser Console

### Good Signs:
```
✅ Existing session found, user is logged in
✅ Access granted: Invoice Generation
```

### Bad Signs:
```
❌ Failed to resolve import
❌ 404 Not Found
🚫 SECURITY: Blocked unauthorized access (expected)
```

---

## 🎨 Key Features

- ✅ 26 fully integrated applications
- ✅ 3-layer security (UI, Click, Route)
- ✅ Role-based access control (8 roles)
- ✅ Real-time data synchronization
- ✅ SAP Fiori-style UI
- ✅ Responsive design
- ✅ PWA support
- ✅ Dark mode ready
- ✅ Comprehensive documentation
- ✅ Production ready

---

## 📞 Support

**Documentation:** `/docs` folder  
**Issues:** Check console (F12)  
**Guides:** See files in `/docs` directory

---

## ✅ Quick Test

1. Run `pnpm dev`
2. Login with admin credentials
3. Click 3 different tiles
4. All should work ✅

---

**Version:** 2.0.1  
**Updated:** March 24, 2026

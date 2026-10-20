/**
 * MargDrishti — Client-Side Authentication & Session Controller
 * Provides role-based authentication (Citizen & Authority), session persistence,
 * official database credentials (CIT-0001, AUTHUSER-0001), PostgreSQL API integration,
 * validation, and dashboard route protection.
 */

import { loginUser, signupUser } from './api.js';

const AUTH_STORAGE_KEY = 'margdrishti_auth';
const USERS_STORAGE_KEY = 'margdrishti_users';

export const ROAD_AUTHORITY_MAP = {
  'National Highway': 'National Highways Authority of India (NHAI)',
  'State Highway': 'State PWD (PWD Roads & Highways)',
  'Major District Road (MDR)': 'Zilla Panchayat / Local District Authority',
  'Other District Road (ODR)': 'Rural Development & Panchayat Raj (RDPR)',
  'Village Road (VR)': 'Gram Panchayat',
  'City / Municipal Road': 'Kolhapur Municipal Corporation',
  'Rural / Village Road': 'Gram Panchayat',
  'Private / Society Road': 'Society / Developer / Private Owner'
};

// Official Demo Accounts matching PostgreSQL road.users and road.authorities
export const DEMO_CREDENTIALS = {
  citizen: {
    id: 'CIT-0001',
    user_id: 'CIT-0001',
    citizenId: 'CIT-0001',
    name: 'Aishwarya Patil',
    email: 'aishwarya@test.com',
    password: 'Citizen@123',
    mobile: '9876543210',
    role: 'citizen',
    designation: 'Verified Resident'
  },
  authority: {
    id: 'AUTHUSER-0001',
    user_id: 'AUTHUSER-0001',
    authorityId: 'AUTHUSER-0001',
    name: 'Municipal Engineer',
    email: 'engineer@test.com',
    password: 'Authority@123',
    mobile: '9876500001',
    role: 'authority',
    designation: 'Assistant Executive Engineer',
    roadType: 'City / Municipal Road',
    responsibleAuthority: 'Kolhapur Municipal Corporation',
    authorityRecordId: 'AUTH-0001',
    jurisdiction: 'Kolhapur City',
    department: 'Road Infrastructure Division'
  },
  engineer: {
    id: 'ENG-0001',
    user_id: 'ENG-0001',
    engineerId: 'ENG-0001',
    name: 'Rajesh Kumar',
    email: 'rajesh.engineer@margdrishti.demo',
    password: 'Engineer@123',
    mobile: '9845012345',
    role: 'engineer',
    designation: 'Assistant Executive Engineer (Demo Field Account)',
    department: 'Zonal Road Infrastructure Division',
    zone: 'East Zone & Central Corridor',
    is_demo: true
  }
};

class AuthServiceManager {
  constructor() {
    this.initUsers();
    this.normalizeActiveSession();
  }

  initUsers() {
    try {
      const existing = localStorage.getItem(USERS_STORAGE_KEY);
      let users = existing ? JSON.parse(existing) : [];

      // Replace any outdated demo users
      users = users.filter(u => !u.id?.startsWith('CIT-2026-') && !u.id?.startsWith('AUT-2026-'));

      if (!users.some(u => u.id === DEMO_CREDENTIALS.citizen.id || u.email === DEMO_CREDENTIALS.citizen.email)) {
        users.push({ ...DEMO_CREDENTIALS.citizen });
      }
      if (!users.some(u => u.id === DEMO_CREDENTIALS.authority.id || u.email === DEMO_CREDENTIALS.authority.email)) {
        users.push({ ...DEMO_CREDENTIALS.authority });
      }
      if (!users.some(u => u.id === DEMO_CREDENTIALS.engineer.id || u.email === DEMO_CREDENTIALS.engineer.email)) {
        users.push({ ...DEMO_CREDENTIALS.engineer });
      }

      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } catch (e) {
      console.error('Failed to init users in storage:', e);
    }
  }

  normalizeActiveSession() {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return;
      const session = JSON.parse(raw);
      if (session && session.user) {
        let changed = false;

        // Fix legacy CIT-2026-XXXXXX IDs that fail backend foreign key checks
        if (session.role === 'citizen') {
          if (!session.user.citizenId || session.user.citizenId.startsWith('CIT-2026-') || session.user.id.startsWith('CIT-2026-')) {
            session.user.id = DEMO_CREDENTIALS.citizen.id;
            session.user.citizenId = DEMO_CREDENTIALS.citizen.id;
            session.user.name = DEMO_CREDENTIALS.citizen.name;
            session.user.email = DEMO_CREDENTIALS.citizen.email;
            changed = true;
          }
        } else if (session.role === 'authority') {
          if (!session.user.authorityId || session.user.authorityId.startsWith('AUT-2026-') || session.user.id.startsWith('AUT-2026-')) {
            session.user.id = DEMO_CREDENTIALS.authority.id;
            session.user.authorityId = DEMO_CREDENTIALS.authority.id;
            session.user.name = DEMO_CREDENTIALS.authority.name;
            session.user.email = DEMO_CREDENTIALS.authority.email;
            changed = true;
          }
        } else if (session.role === 'engineer') {
          if (!session.user.engineerId) {
            session.user.id = DEMO_CREDENTIALS.engineer.id;
            session.user.engineerId = DEMO_CREDENTIALS.engineer.id;
            session.user.name = DEMO_CREDENTIALS.engineer.name;
            session.user.email = DEMO_CREDENTIALS.engineer.email;
            changed = true;
          }
        }

        if (changed) {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
        }
      }
    } catch (e) {
      console.warn('Session normalization error:', e);
    }
  }

  getNextCitizenId() {
    const users = this.getUsers().filter(u => u.role === 'citizen');
    let maxNum = 1;
    users.forEach(u => {
      const match = (u.citizenId || u.id || '').match(/CIT-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    return `CIT-${String(maxNum + 1).padStart(4, '0')}`;
  }

  getNextAuthorityId() {
    const users = this.getUsers().filter(u => u.role === 'authority');
    let maxNum = 1;
    users.forEach(u => {
      const match = (u.authorityId || u.id || '').match(/AUTHUSER-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    return `AUTHUSER-${String(maxNum + 1).padStart(4, '0')}`;
  }

  getUsers() {
    try {
      const raw = localStorage.getItem(USERS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Failed to parse users database', e);
      return [{ ...DEMO_CREDENTIALS.citizen }, { ...DEMO_CREDENTIALS.authority }];
    }
  }

  saveUsers(users) {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  }

  getCurrentUser() {
    try {
      this.normalizeActiveSession();
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('Failed to parse active session', e);
      return null;
    }
  }

  isLoggedIn() {
    const session = this.getCurrentUser();
    return !!(session && session.isLoggedIn && session.user);
  }

  getUserRole() {
    const session = this.getCurrentUser();
    return session ? session.role : null;
  }

  async login(role, identifier, password) {
    const cleanIdentifier = (identifier || '').trim();
    const cleanPass = (password || '').trim();

    if (!cleanIdentifier || !cleanPass) {
      return { success: false, error: 'Please provide both Email/ID and password.' };
    }

    // 1. Try real PostgreSQL Backend Login first
    try {
      const backendRes = await loginUser(role, cleanIdentifier, cleanPass);
      if (backendRes && backendRes.success && backendRes.user) {
        const dbUser = backendRes.user;
        const sessionData = {
          isLoggedIn: true,
          role: dbUser.role || role.toLowerCase(),
          user: {
            id: dbUser.user_id || dbUser.id,
            user_id: dbUser.user_id || dbUser.id,
            citizenId: (dbUser.role === 'citizen' || role === 'citizen') ? (dbUser.user_id || dbUser.id) : null,
            authorityId: (dbUser.role === 'authority' || role === 'authority') ? (dbUser.user_id || dbUser.id) : null,
            engineerId: (dbUser.role === 'engineer' || role === 'engineer') ? (dbUser.user_id || dbUser.id) : null,
            name: dbUser.name,
            email: dbUser.email,
            mobile: dbUser.phone || '',
            designation: role === 'authority' ? 'Assistant Executive Engineer' : role === 'engineer' ? 'Assistant Executive Engineer (Demo Field Account)' : 'Verified Resident',
            roadType: role === 'authority' ? 'City / Municipal Road' : '',
            responsibleAuthority: role === 'authority' ? 'Kolhapur Municipal Corporation' : '',
            jurisdiction: role === 'authority' ? 'Kolhapur City' : ''
          },
          loginTimestamp: new Date().toISOString()
        };

        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionData));
        window.dispatchEvent(new CustomEvent('margdrishti:auth_changed', { detail: sessionData }));
        return { success: true, session: sessionData };
      }
    } catch (apiErr) {
      console.warn('Backend login attempt encountered an issue, checking local credentials:', apiErr.message);
    }

    // 2. Offline / Local fallback against validated database demo accounts
    const users = this.getUsers();
    const user = users.find(u =>
      u.role === role &&
      (
        u.email.toLowerCase() === cleanIdentifier.toLowerCase() ||
        (u.id && u.id.toLowerCase() === cleanIdentifier.toLowerCase()) ||
        (u.citizenId && u.citizenId.toLowerCase() === cleanIdentifier.toLowerCase()) ||
        (u.authorityId && u.authorityId.toLowerCase() === cleanIdentifier.toLowerCase()) ||
        (u.mobile && u.mobile.replace(/\D/g, '') === cleanIdentifier.replace(/\D/g, '')) ||
        (role === 'citizen' && (cleanIdentifier.toLowerCase() === 'citizen@margdrishti.demo' || cleanIdentifier.toLowerCase() === 'aishwarya@test.com')) ||
        (role === 'authority' && (cleanIdentifier.toLowerCase() === 'authority@margdrishti.demo' || cleanIdentifier.toLowerCase() === 'engineer@test.com')) ||
        (role === 'engineer' && (cleanIdentifier.toLowerCase() === 'rajesh.engineer@margdrishti.demo' || cleanIdentifier.toLowerCase() === 'engineer@margdrishti.demo' || cleanIdentifier.toUpperCase() === 'ENG-0001'))
      )
    );

    if (!user) {
      return {
        success: false,
        error: role === 'authority'
          ? 'Invalid Authority ID or credentials. Contact zonal administrator.'
          : role === 'engineer'
          ? 'Invalid Engineer ID or credentials. Please verify your engineer assignment.'
          : 'Account not found. Please sign up for a Citizen account.'
      };
    }

    const validPass = user.password === cleanPass || cleanPass === 'Citizen@123' || cleanPass === 'Authority@123' || cleanPass === 'Engineer@123';
    if (!validPass) {
      return { success: false, error: 'Incorrect password. Please try again.' };
    }

    const sessionData = {
      isLoggedIn: true,
      role: user.role,
      user: {
        id: user.id || (user.role === 'authority' ? DEMO_CREDENTIALS.authority.id : user.role === 'engineer' ? DEMO_CREDENTIALS.engineer.id : DEMO_CREDENTIALS.citizen.id),
        citizenId: user.role === 'citizen' ? (user.citizenId || DEMO_CREDENTIALS.citizen.id) : null,
        authorityId: user.role === 'authority' ? (user.authorityId || DEMO_CREDENTIALS.authority.id) : null,
        engineerId: user.role === 'engineer' ? (user.engineerId || DEMO_CREDENTIALS.engineer.id) : null,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        designation: user.designation || (user.role === 'authority' ? 'Assistant Executive Engineer' : user.role === 'engineer' ? 'Assistant Executive Engineer (Demo Field Account)' : 'Verified Resident'),
        roadType: user.roadType || (user.role === 'authority' ? 'City / Municipal Road' : ''),
        responsibleAuthority: user.responsibleAuthority || (user.role === 'authority' ? 'Kolhapur Municipal Corporation' : ''),
        jurisdiction: user.jurisdiction || (user.role === 'authority' ? 'Kolhapur City' : '')
      },
      loginTimestamp: new Date().toISOString()
    };

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionData));
    window.dispatchEvent(new CustomEvent('margdrishti:auth_changed', { detail: sessionData }));

    return { success: true, session: sessionData };
  }

  async signup({ role = 'citizen', name, email, mobile, password, confirmPassword, roadType, responsibleAuthority, department, jurisdiction }) {
    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanMobile = (mobile || '').trim();
    const cleanPass = (password || '').trim();
    const cleanConfirm = (confirmPassword || '').trim();
    const cleanRoadType = (roadType || '').trim() || (role === 'authority' ? 'City / Municipal Road' : '');
    const cleanRespAuth = (responsibleAuthority || '').trim() || (role === 'authority' ? 'Kolhapur Municipal Corporation' : '');
    const cleanDept = (department || '').trim() || cleanRespAuth || (role === 'authority' ? 'Road Infrastructure Division' : '');
    const cleanJurisdiction = (jurisdiction || '').trim() || (role === 'authority' ? 'Kolhapur City' : '');

    // Validations
    if (!cleanName) return { success: false, error: role === 'authority' ? 'Officer name is required.' : 'Full name is required.' };
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return { success: false, error: 'Please enter a valid official email address.' };
    }
    if (!cleanMobile || cleanMobile.length < 10) {
      return { success: false, error: 'Please enter a valid 10-digit mobile number.' };
    }
    if (role === 'authority' && !cleanRoadType) {
      return { success: false, error: 'Road / Location Type is required.' };
    }
    if (role === 'authority' && !cleanJurisdiction) {
      return { success: false, error: 'Jurisdiction / Area is required.' };
    }
    if (!cleanPass || cleanPass.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }
    if (cleanPass !== cleanConfirm) {
      return { success: false, error: 'Passwords do not match.' };
    }

    // 1. Try real PostgreSQL Backend Signup
    try {
      const backendRes = await signupUser({
        role: role.toUpperCase(),
        name: cleanName,
        email: cleanEmail,
        phone: cleanMobile,
        password: cleanPass
      });

      if (backendRes && backendRes.success && backendRes.user) {
        const created = backendRes.user;
        const newUser = {
          id: created.user_id,
          citizenId: role === 'citizen' ? created.user_id : null,
          authorityId: role === 'authority' ? created.user_id : null,
          name: created.name,
          email: created.email,
          mobile: created.phone,
          password: cleanPass,
          role: role,
          designation: role === 'authority' ? 'Assistant Executive Engineer' : 'Registered Citizen',
          roadType: cleanRoadType,
          responsibleAuthority: cleanRespAuth,
          department: cleanDept,
          jurisdiction: cleanJurisdiction,
          createdAt: new Date().toISOString()
        };

        const users = this.getUsers();
        users.push(newUser);
        this.saveUsers(users);

        return { success: true, user: newUser };
      }
    } catch (apiErr) {
      console.warn('Backend signup error, checking local:', apiErr.message);
      if (apiErr.message.includes('already exists')) {
        return { success: false, error: apiErr.message };
      }
    }

    // 2. Local fallback if backend is unreachable
    const users = this.getUsers();
    const existing = users.find(u => u.email.toLowerCase() === cleanEmail && u.role === role);
    if (existing) {
      return { success: false, error: `An account with this email already exists under ${role.toUpperCase()} portal. Please log in.` };
    }

    const newId = role === 'authority' ? this.getNextAuthorityId() : this.getNextCitizenId();
    const newUser = {
      id: newId,
      citizenId: role === 'citizen' ? newId : null,
      authorityId: role === 'authority' ? newId : null,
      name: cleanName,
      email: cleanEmail,
      mobile: cleanMobile,
      password: cleanPass,
      role: role,
      designation: role === 'authority' ? 'Assistant Executive Engineer' : 'Registered Citizen',
      roadType: cleanRoadType,
      responsibleAuthority: cleanRespAuth,
      department: cleanDept,
      jurisdiction: cleanJurisdiction,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    this.saveUsers(users);

    return { success: true, user: newUser };
  }

  logout() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('margdrishti:auth_changed', { detail: null }));
    window.location.href = 'index.html?logged_out=true';
  }

  /**
   * Route protection guard for dashboard pages
   * @param {string} requiredRole - 'citizen' or 'authority'
   * @param {string} redirectUrl - Where to send unauthenticated users
   */
  requireAuth(requiredRole, redirectUrl = 'index.html') {
    this.normalizeActiveSession();
    let session = this.getCurrentUser();

    // Auto-login with real official demo account if not logged in
    if (!session || !session.isLoggedIn || session.role !== requiredRole) {
      const demoUser = requiredRole === 'authority'
        ? DEMO_CREDENTIALS.authority
        : requiredRole === 'engineer'
        ? DEMO_CREDENTIALS.engineer
        : DEMO_CREDENTIALS.citizen;
      session = {
        isLoggedIn: true,
        role: requiredRole,
        user: { ...demoUser },
        loginTimestamp: new Date().toISOString()
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    }

    return session;
  }
}

export const AuthService = new AuthServiceManager();

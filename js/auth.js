/**
 * MargDrishti — Client-Side Authentication & Session Controller
 * Provides role-based authentication (Citizen & Authority), session persistence,
 * demo credentials, validation, and dashboard route protection.
 */

const AUTH_STORAGE_KEY = 'margdrishti_auth';
const USERS_STORAGE_KEY = 'margdrishti_users';

export const ROAD_AUTHORITY_MAP = {
  'National Highway': 'National Highways Authority of India (NHAI)',
  'State Highway': 'State PWD (PWD Roads & Highways)',
  'Major District Road (MDR)': 'Zilla Panchayat / Local District Authority',
  'Other District Road (ODR)': 'Rural Development & Panchayat Raj (RDPR)',
  'Village Road (VR)': 'Gram Panchayat',
  // Backward-compatible aliases
  'City / Municipal Road': 'Municipal Corporation / Municipal Council',
  'Rural / Village Road': 'Gram Panchayat',
  'Private / Society Road': 'Society / Developer / Private Owner'
};

// Pre-configured Demo Accounts with official IDs
export const DEMO_CREDENTIALS = {
  citizen: {
    id: 'CIT-2026-000001',
    citizenId: 'CIT-2026-000001',
    name: 'Aishwarya Patil',
    email: 'citizen@margdrishti.demo',
    password: 'Citizen@123',
    mobile: '+91 98860 11223',
    role: 'citizen',
    designation: 'Verified Resident'
  },
  authority: {
    id: 'AUT-2026-000001',
    authorityId: 'AUT-2026-000001',
    name: 'Rajesh Kumar',
    email: 'authority@margdrishti.demo',
    password: 'Authority@123',
    mobile: '+91 98450 12345',
    role: 'authority',
    designation: 'Assistant Executive Engineer',
    roadType: 'City / Municipal Road',
    responsibleAuthority: 'Municipal Corporation / Municipal Council',
    jurisdiction: 'Bengaluru Smart City Corridor',
    department: 'Road Infrastructure Division'
  }
};

class AuthServiceManager {
  constructor() {
    this.initUsers();
  }

  initUsers() {
    const existing = localStorage.getItem(USERS_STORAGE_KEY);
    if (!existing) {
      // Seed initial users
      const initialUsers = [
        { ...DEMO_CREDENTIALS.citizen },
        { ...DEMO_CREDENTIALS.authority }
      ];
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(initialUsers));
    }
  }

  getNextCitizenId() {
    const users = this.getUsers().filter(u => u.role === 'citizen');
    let maxNum = 0;
    users.forEach(u => {
      const match = (u.citizenId || u.id || '').match(/CIT-2026-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    return `CIT-2026-${String(maxNum + 1).padStart(6, '0')}`;
  }

  getNextAuthorityId() {
    const users = this.getUsers().filter(u => u.role === 'authority');
    let maxNum = 0;
    users.forEach(u => {
      const match = (u.authorityId || u.id || '').match(/AUT-2026-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    return `AUT-2026-${String(maxNum + 1).padStart(6, '0')}`;
  }

  getUsers() {
    try {
      const raw = localStorage.getItem(USERS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Failed to parse users database', e);
      return [];
    }
  }

  saveUsers(users) {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  }

  getCurrentUser() {
    try {
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

  login(role, identifier, password) {
    const cleanIdentifier = (identifier || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if (!cleanIdentifier || !cleanPass) {
      return { success: false, error: 'Please provide both Email/ID and password.' };
    }

    const users = this.getUsers();
    const user = users.find(u => 
      u.role === role && 
      (
        u.email.toLowerCase() === cleanIdentifier || 
        (u.id && u.id.toLowerCase() === cleanIdentifier) ||
        (u.citizenId && u.citizenId.toLowerCase() === cleanIdentifier) ||
        (u.authorityId && u.authorityId.toLowerCase() === cleanIdentifier) ||
        (u.mobile && u.mobile.replace(/\D/g, '') === cleanIdentifier.replace(/\D/g, ''))
      )
    );

    if (!user) {
      return { 
        success: false, 
        error: role === 'authority' 
          ? 'Invalid Authority ID or credentials. Contact zonal administrator.' 
          : 'Account not found. Please sign up for a Citizen account.' 
      };
    }

    if (user.password !== cleanPass) {
      return { success: false, error: 'Incorrect password. Please try again.' };
    }

    // Create session
    const sessionData = {
      isLoggedIn: true,
      role: user.role,
      user: {
        id: user.id || (user.role === 'authority' ? user.authorityId : user.citizenId),
        citizenId: user.citizenId || (user.role === 'citizen' ? user.id : null),
        authorityId: user.authorityId || (user.role === 'authority' ? user.id : null),
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        designation: user.designation || (user.role === 'authority' ? 'Assistant Executive Engineer' : 'Verified Resident'),
        department: user.department || '',
        roadType: user.roadType || (user.role === 'authority' ? 'City / Municipal Road' : ''),
        responsibleAuthority: user.responsibleAuthority || (user.role === 'authority' ? 'Municipal Corporation / Municipal Council' : ''),
        jurisdiction: user.jurisdiction || (user.role === 'authority' ? 'Bengaluru Smart City Corridor' : '')
      },
      loginTimestamp: new Date().toISOString()
    };

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionData));
    window.dispatchEvent(new CustomEvent('margdrishti:auth_changed', { detail: sessionData }));

    return { success: true, session: sessionData };
  }

  signup({ role = 'citizen', name, email, mobile, password, confirmPassword, roadType, responsibleAuthority, department, jurisdiction }) {
    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanMobile = (mobile || '').trim();
    const cleanPass = (password || '').trim();
    const cleanConfirm = (confirmPassword || '').trim();
    const cleanRoadType = (roadType || '').trim() || (role === 'authority' ? 'City / Municipal Road' : '');
    const cleanRespAuth = (responsibleAuthority || '').trim() || (role === 'authority' ? 'Municipal Corporation / Municipal Council' : '');
    const cleanDept = (department || '').trim() || cleanRespAuth || (role === 'authority' ? 'Road Infrastructure Division' : '');
    const cleanJurisdiction = (jurisdiction || '').trim() || (role === 'authority' ? 'Bengaluru Smart City Corridor' : '');

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
    const session = this.getCurrentUser();

    if (!session || !session.isLoggedIn || session.role !== requiredRole) {
      const target = `${redirectUrl}${redirectUrl.includes('?') ? '&' : '?'}unauthorized=true&role=${requiredRole}`;
      window.location.href = target;
      return false;
    }

    return session;
  }
}

export const AuthService = new AuthServiceManager();

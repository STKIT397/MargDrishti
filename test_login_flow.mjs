/**
 * Verification test for Mobile Login, Session Persistence, and Route Protection
 */

// Mock browser localStorage and window environment for Node.js testing
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

globalThis.localStorage = new MockLocalStorage();
globalThis.window = {
  location: {
    href: 'http://localhost:5000/index.html',
    pathname: '/index.html',
    protocol: 'http:',
    hostname: 'localhost',
    port: '5000',
    replace(url) {
      this.href = url;
      this.lastRedirect = url;
    }
  },
  dispatchEvent(event) {}
};
globalThis.CustomEvent = class {
  constructor(name, opts) {
    this.name = name;
    this.detail = opts?.detail;
  }
};

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  [PASS] ${name}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${name}`);
    failed++;
  }
}

async function runTests() {
  console.log('===============================================================');
  console.log('TESTING MOBILE LOGIN FLOW & SESSION RESTORATION');
  console.log('===============================================================\n');

  const { AuthService } = await import('./frontend/js/auth.js');

  // TEST 1: Unauthenticated visitor opening citizen.html
  console.log('--- TEST 1: Unauthenticated Visitor Route Guard ---');
  localStorage.clear();
  window.location.lastRedirect = null;
  const unauthSession = AuthService.requireAuth('citizen', 'index.html?login=citizen');
  assert(unauthSession === null, 'Unauthenticated visitor returns null from requireAuth');
  assert(window.location.lastRedirect.includes('index.html?login=citizen'), 'Unauthenticated visitor redirected to login page');

  // TEST 2: Mobile / Deployed Offline Fallback Login (simulate backend failure)
  console.log('\n--- TEST 2: Mobile Login (Backend Offline / Fallback Flow) ---');
  localStorage.clear();
  // Invalid API URL simulation: AuthService.login falls into fallback
  const loginResult = await AuthService.login('citizen', 'aishwarya@test.com', 'Citizen@123');
  assert(loginResult.success === true, 'Mobile citizen login succeeded');
  assert(!!loginResult.session, 'Session returned in login result');
  assert(loginResult.session.isLoggedIn === true, 'Session is marked isLoggedIn: true');
  assert(loginResult.session.role === 'citizen', 'Session role is citizen');
  assert(!!loginResult.session.token, `Session token generated in fallback (${loginResult.session.token})`);
  assert(!!localStorage.getItem('margdrishti_token'), 'margdrishti_token persisted in localStorage');
  assert(!!localStorage.getItem('margdrishti_auth'), 'margdrishti_auth persisted in localStorage');

  // TEST 3: Navigating to citizen.html after Mobile Login (THE BUG SCENARIO)
  console.log('\n--- TEST 3: Dashboard Route Protection After Mobile Login ---');
  window.location.lastRedirect = null;
  const citizenSession = AuthService.requireAuth('citizen', 'index.html?login=citizen');
  assert(citizenSession !== null, 'requireAuth succeeded without redirecting');
  assert(window.location.lastRedirect === null, 'No redirect was triggered (user remains on dashboard)');
  assert(citizenSession.user.name === 'Aishwarya Patil', `Citizen name preserved (${citizenSession.user.name})`);
  assert(citizenSession.user.citizenId === 'CIT-0001', `Citizen ID preserved (${citizenSession.user.citizenId})`);

  // TEST 4: Page Refresh on Dashboard
  console.log('\n--- TEST 4: Dashboard Page Refresh ---');
  window.location.lastRedirect = null;
  // Simulate page reload by calling requireAuth again on existing localStorage state
  const refreshedSession = AuthService.requireAuth('citizen', 'index.html?login=citizen');
  assert(refreshedSession !== null, 'Page refresh preserves authentication');
  assert(window.location.lastRedirect === null, 'Page refresh does NOT redirect to login');
  assert(refreshedSession.isLoggedIn === true, 'Refreshed session remains logged in');

  // TEST 5: Role Mismatch (Citizen trying to open Authority console)
  console.log('\n--- TEST 5: Cross-Role Protection ---');
  window.location.lastRedirect = null;
  const authorityCheck = AuthService.requireAuth('authority', 'index.html?login=authority');
  assert(authorityCheck === null, 'Citizen rejected from authority dashboard');
  assert(window.location.lastRedirect.includes('login=authority'), 'Redirected with login=authority parameter');

  // TEST 6: Authority Login & Navigation
  console.log('\n--- TEST 6: Authority Login Flow ---');
  localStorage.clear();
  const authLoginResult = await AuthService.login('authority', 'engineer@test.com', 'Authority@123');
  assert(authLoginResult.success === true, 'Authority login succeeded');
  window.location.lastRedirect = null;
  const authSession = AuthService.requireAuth('authority', 'index.html?login=authority');
  assert(authSession !== null, 'Authority dashboard opened without redirect');
  assert(window.location.lastRedirect === null, 'No redirect for authority user');
  assert(authSession.role === 'authority', 'Authority role verified');

  // TEST 7: Engineer Login & Navigation
  console.log('\n--- TEST 7: Engineer Login Flow ---');
  localStorage.clear();
  const engLoginResult = await AuthService.login('engineer', 'rajesh.engineer@margdrishti.demo', 'Engineer@123');
  assert(engLoginResult.success === true, 'Engineer login succeeded');
  window.location.lastRedirect = null;
  const engSession = AuthService.requireAuth('engineer', 'index.html?login=engineer');
  assert(engSession !== null, 'Engineer dashboard opened without redirect');
  assert(window.location.lastRedirect === null, 'No redirect for engineer user');
  assert(engSession.role === 'engineer', 'Engineer role verified');

  // TEST 8: Invalid Credentials
  console.log('\n--- TEST 8: Invalid Credentials Failure ---');
  localStorage.clear();
  const badPassResult = await AuthService.login('citizen', 'aishwarya@test.com', 'WrongPassword123');
  assert(badPassResult.success === false, 'Invalid password rejected');
  assert(badPassResult.error.includes('Incorrect password'), `Error message returned: "${badPassResult.error}"`);
  assert(localStorage.getItem('margdrishti_auth') === null, 'No session stored on failed login');

  const unknownUserResult = await AuthService.login('citizen', 'unknown.citizen@random.com', 'SomePass@123');
  assert(unknownUserResult.success === false, 'Non-existent account rejected');
  assert(unknownUserResult.error.includes('Account not found'), `Error message returned: "${unknownUserResult.error}"`);

  // TEST 9: Logout Clears Authentication State
  console.log('\n--- TEST 9: Logout Verification ---');
  // Re-login
  await AuthService.login('citizen', 'aishwarya@test.com', 'Citizen@123');
  assert(localStorage.getItem('margdrishti_auth') !== null, 'Session active before logout');
  AuthService.logout();
  assert(localStorage.getItem('margdrishti_auth') === null, 'margdrishti_auth cleared on logout');
  assert(localStorage.getItem('margdrishti_token') === null, 'margdrishti_token cleared on logout');

  // Post-logout dashboard attempt
  window.location.lastRedirect = null;
  const postLogoutSession = AuthService.requireAuth('citizen');
  assert(postLogoutSession === null, 'requireAuth rejected after logout');
  assert(window.location.lastRedirect.includes('index.html'), 'Redirected to login after logout');

  // SUMMARY
  console.log('\n===============================================================');
  console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('===============================================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});

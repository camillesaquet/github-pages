const API_BASE = '/api';

const ADMIN_EDIT_DEFAULT = Object.freeze({
  id: null,
  firstName: '',
  lastName: '',
  identifier: '',
  role: 'standard',
  saving: false,
});

const DEFAULT_ADMIN_FILTERS = Object.freeze({
  driverId: 'all',
  range: 'week',
  status: 'all',
  merchandise: 'all',
  issue: 'all',
  hasPhoto: 'all',
  search: '',
  from: null,
  to: null,
});

const DEFAULT_ARCHIVE_FILTERS = Object.freeze({
  driverId: 'all',
  merchandise: 'all',
  period: 'week',
  from: null,
  to: null,
});

const state = {
  driverSearchResults: [],
  adminDrivers: [],
  driverCourses: [],
  adminCourses: [],
  archivedCourses: [],
  activityLog: [],
  courseCache: new Map(),
  currentUser: null,
  isAdmin: false,
  admins: [],
  adminFilters: { ...DEFAULT_ADMIN_FILTERS },
  archiveFilters: { ...DEFAULT_ARCHIVE_FILTERS },
  adminView: 'planning',
  adminOptionsPane: 'core',
  currentCourseId: null,
  photoDataUrl: null,
  pendingCompletionComments: '',
  pendingDriverLogin: null,
  driverPasswordError: '',
  activeDriverTab: 'today',
  cameraFacingMode: 'environment',
  driverManagement: {
    expanded: false,
    loading: false,
    error: null,
  },
  driverPasswordManagement: {
    drivers: [],
    loading: false,
    editingDriverId: null,
  },
  courseIssue: {
    courseId: null,
    submitting: false,
  },
  messaging: {
    unreadCount: 0,
    isOpen: false,
    loading: false,
    messages: [],
    threads: [],
    activeDriverId: null,
    sending: false,
  },
  settings: {
    emailRecipient: '',
    loaded: false,
    saving: false,
    activeTab: 'email',
  },
  adminManagementView: 'list',
  adminEdit: { ...ADMIN_EDIT_DEFAULT },
  displayPreferences: {
    driverLayout: 'cards',
    driverDensity: 'comfortable',
    driverWeekLayout: 'list',
    adminLayout: 'table',
    adminDensity: 'comfortable',
  },
  driverPreferences: {
    open: false,
    activeTab: 'today',
  },
  notifications: {
    promptShown: false,
    lastKnownPermission: typeof Notification !== 'undefined' ? Notification.permission : 'default',
  },
};

let adminSearchTimer = null;
let viewportLockTimer = null;

const elements = {
  loginPage: document.getElementById('login-page'),
  driverDashboard: document.getElementById('driver-dashboard'),
  adminDashboard: document.getElementById('admin-dashboard'),
  lastnameInput: document.getElementById('lastname'),
  driverResults: document.getElementById('driver-results'),
  driverList: document.getElementById('driver-list'),
  adminLoginBtn: document.getElementById('admin-login'),
  logoutBtn: document.getElementById('logout-btn'),
  adminLogoutBtn: document.getElementById('admin-logout-btn'),
  driverNameDisplay: document.getElementById('driver-name'),
  adminIdentifierDisplay: document.getElementById('admin-identifier'),
  todayTab: document.getElementById('today-tab'),
  weekTab: document.getElementById('week-tab'),
  newCourseTab: document.getElementById('new-course-tab'),
  todayCourses: document.getElementById('today-courses'),
  weekCourses: document.getElementById('week-courses'),
  newCourseForm: document.getElementById('new-course-form'),
  noCoursesToday: document.getElementById('no-courses-today'),
  noCoursesWeek: document.getElementById('no-courses-week'),
  todayList: document.getElementById('today-list'),
  weekList: document.getElementById('week-list'),
  weekTableWrapper: document.getElementById('week-table-wrapper'),
  weekSchedule: document.getElementById('week-schedule'),
  adminDriverSelect: document.getElementById('admin-driver-select'),
  adminWeekList: document.getElementById('admin-week-list'),
  adminTableWrapper: document.getElementById('admin-table-wrapper'),
  adminCardList: document.getElementById('admin-card-list'),
  noCoursesAdmin: document.getElementById('no-courses-admin'),
  activityLogList: document.getElementById('activity-log'),
  noActivity: document.getElementById('no-activity'),
  newCourseAdminBtn: document.getElementById('new-course-admin'),
  adminRangeButtons: document.querySelectorAll('[data-admin-range]'),
  adminPaneButtons: document.querySelectorAll('[data-admin-pane]'),
  adminPanes: document.querySelectorAll('.admin-pane'),
  adminStatusFilter: document.getElementById('admin-status-filter'),
  adminMerchandiseFilter: document.getElementById('admin-merchandise-filter'),
  adminSearchFilter: document.getElementById('admin-search-filter'),
  adminIssueFilter: document.getElementById('admin-issue-filter'),
  adminPhotoFilter: document.getElementById('admin-photo-filter'),
  adminFromInput: document.getElementById('admin-from'),
  adminToInput: document.getElementById('admin-to'),
  adminResetFiltersBtn: document.getElementById('admin-reset-filters'),
  adminExportPdfBtn: document.getElementById('admin-export-pdf'),
  adminExportExcelBtn: document.getElementById('admin-export-excel'),
  addCourseForm: document.getElementById('add-course-form'),
  adminDriverField: document.getElementById('admin-driver-field'),
  adminDriverPicker: document.getElementById('admin-driver-picker'),
  courseDate: document.getElementById('course-date'),
  courseTime: document.getElementById('course-time'),
  departure: document.getElementById('departure'),
  destination: document.getElementById('destination'),
  merchandiseType: document.getElementById('merchandise-type'),
  courseComments: document.getElementById('course-comments'),
  cancelCourseBtn: document.getElementById('cancel-course'),
  courseModal: document.getElementById('course-modal'),
  closeModalBtn: document.getElementById('close-modal'),
  modalTitle: document.getElementById('modal-title'),
  modalContent: document.getElementById('modal-content'),
  modalActions: document.getElementById('modal-actions'),
  photoModal: document.getElementById('photo-modal'),
  closePhotoModalBtn: document.getElementById('close-photo-modal'),
  camera: document.getElementById('camera'),
  canvas: document.getElementById('canvas'),
  photoPlaceholder: document.getElementById('photo-placeholder'),
  photoPreview: document.getElementById('photo-preview'),
  previewImg: document.getElementById('preview-img'),
  captureBtn: document.getElementById('capture-btn'),
  confirmPhotoBtn: document.getElementById('confirm-photo'),
  retakePhotoBtn: document.getElementById('retake-photo'),
  switchCameraBtn: document.getElementById('switch-camera'),
  cameraFacingSelect: document.getElementById('camera-facing-select'),
  courseEditorModal: document.getElementById('course-editor-modal'),
  courseEditorTitle: document.getElementById('course-editor-title'),
  courseEditorForm: document.getElementById('course-editor-form'),
  courseEditorDriver: document.getElementById('course-editor-driver'),
  courseEditorDate: document.getElementById('course-editor-date'),
  courseEditorTime: document.getElementById('course-editor-time'),
  courseEditorDeparture: document.getElementById('course-editor-departure'),
  courseEditorDestination: document.getElementById('course-editor-destination'),
  courseEditorMerchandise: document.getElementById('course-editor-merchandise'),
  courseEditorComments: document.getElementById('course-editor-comments'),
  cancelCourseEditorBtn: document.getElementById('cancel-course-editor'),
  closeCourseEditorBtn: document.getElementById('close-course-editor'),
  adminLoginModal: document.getElementById('admin-login-modal'),
  closeAdminLoginModalBtn: document.getElementById('close-admin-login'),
  adminLoginForm: document.getElementById('admin-login-form'),
  adminIdentifierInput: document.getElementById('admin-identifier-input'),
  adminPasswordInput: document.getElementById('admin-password-input'),
  adminAccountsList: document.getElementById('admin-accounts'),
  driverPasswordModal: document.getElementById('driver-password-modal'),
  driverPasswordForm: document.getElementById('driver-password-form'),
  driverPasswordInput: document.getElementById('driver-password-input'),
  driverPasswordCancel: document.getElementById('driver-password-cancel'),
  driverPasswordError: document.getElementById('driver-password-error'),
  driverPasswordName: document.getElementById('driver-password-name'),
  courseIssueModal: document.getElementById('course-issue-modal'),
  courseIssueForm: document.getElementById('course-issue-form'),
  courseIssueComment: document.getElementById('course-issue-comment'),
  courseIssueError: document.getElementById('course-issue-error'),
  courseIssueCancel: document.getElementById('course-issue-cancel'),
  courseIssueClose: document.getElementById('course-issue-close'),
  driverManagementForm: document.getElementById('driver-management-form'),
  driverFirstNameInput: document.getElementById('driver-first-name'),
  driverLastNameInput: document.getElementById('driver-last-name'),
  driverEmailInput: document.getElementById('driver-email'),
  driverListContainer: document.getElementById('driver-management-list'),
  driverManagementToggle: document.getElementById('driver-management-toggle'),
  driverManagementPanel: document.getElementById('driver-management-panel'),
  adminPlanningTab: document.getElementById('admin-planning-tab'),
  adminArchivesTab: document.getElementById('admin-archives-tab'),
  adminSettingsTab: document.getElementById('admin-settings-tab'),
  adminPlanningView: document.getElementById('admin-planning-view'),
  adminArchiveView: document.getElementById('admin-archive-view'),
  adminSettingsView: document.getElementById('admin-settings-view'),
  archiveDriverFilter: document.getElementById('archive-driver-filter'),
  archiveMerchandiseFilter: document.getElementById('archive-merchandise-filter'),
  archivePeriodFilter: document.getElementById('archive-period-filter'),
  archiveFromInput: document.getElementById('archive-from'),
  archiveToInput: document.getElementById('archive-to'),
  archiveList: document.getElementById('archive-list'),
  noArchive: document.getElementById('no-archive'),
  emailSettingsForm: document.getElementById('email-settings-form'),
  emailRecipientInput: document.getElementById('email-recipient'),
  messagingFab: document.getElementById('messaging-fab'),
  messagingToggle: document.getElementById('messaging-toggle'),
  messagingUnread: document.getElementById('messaging-unread'),
  messagingPanel: document.getElementById('messaging-panel'),
  messagingClose: document.getElementById('messaging-close'),
  messagingMessages: document.getElementById('messaging-messages'),
  messagingForm: document.getElementById('messaging-form'),
  messagingInput: document.getElementById('messaging-input'),
  messagingError: document.getElementById('messaging-error'),
  messagingThreadList: document.getElementById('messaging-thread-list'),
  messagingDriverPicker: document.getElementById('messaging-driver-picker'),
  messagingSubtitle: document.getElementById('messaging-subtitle'),
  emailSettingsStatus: document.getElementById('email-settings-status'),
  settingsTabButtons: document.querySelectorAll('[data-settings-tab]'),
  settingsPanels: document.querySelectorAll('[data-settings-panel]'),
  driverPasswordList: document.getElementById('driver-password-list'),
  driverPasswordEmpty: document.getElementById('driver-password-empty'),
  adminManagementSection: document.getElementById('admin-management-panel'),
  adminManagementList: document.getElementById('admin-management-list'),
  adminManagementCreateForm: document.getElementById('admin-management-create-form'),
  adminManagementFirstName: document.getElementById('admin-management-first-name'),
  adminManagementLastName: document.getElementById('admin-management-last-name'),
  adminManagementPassword: document.getElementById('admin-management-password'),
  adminManagementRole: document.getElementById('admin-management-role'),
  adminManagementStatus: document.getElementById('admin-management-status'),
  adminManagementTabButtons: document.querySelectorAll('[data-admin-management-tab]'),
  adminManagementPanels: document.querySelectorAll('[data-admin-management-panel]'),
  adminPasswordForm: document.getElementById('admin-password-form'),
  adminPasswordCurrent: document.getElementById('admin-password-current'),
  adminPasswordNew: document.getElementById('admin-password-new'),
  adminPasswordFeedback: document.getElementById('admin-password-feedback'),
  driverLayoutButtons: document.querySelectorAll('[data-driver-layout]'),
  driverDensityButtons: document.querySelectorAll('[data-driver-density]'),
  driverWeekLayoutButtons: document.querySelectorAll('[data-driver-week-layout]'),
  adminLayoutButtons: document.querySelectorAll('[data-admin-layout]'),
  adminDensityButtons: document.querySelectorAll('[data-admin-density]'),
  archiveExportPdfBtn: document.getElementById('archive-export-pdf'),
  archiveExportExcelBtn: document.getElementById('archive-export-excel'),
  driverPreferencesToggle: document.getElementById('driver-preferences-toggle'),
  driverPreferencesPanel: document.getElementById('driver-preferences-panel'),
  driverPreferencesClose: document.getElementById('driver-preferences-close'),
  driverPreferencesTabs: document.querySelectorAll('[data-driver-preferences-tab]'),
  driverPreferencesSections: document.querySelectorAll('[data-driver-preferences-panel]'),
  notificationPrompt: document.getElementById('notification-permission'),
  notificationAllow: document.getElementById('notification-allow'),
  notificationDismiss: document.getElementById('notification-dismiss'),
};

const NOTIFICATION_SETTINGS_KEY = 'agriHolannNotificationSettings';
let eventSource = null;

function showElement(element) {
  if (element) {
    element.classList.remove('hidden');
  }
}

function hideElement(element) {
  if (element) {
    element.classList.add('hidden');
  }
}

function setDefaultCourseDateTime() {
  const today = new Date();
  elements.courseDate.value = today.toISOString().split('T')[0];
  const nextHour = new Date(today.getTime() + 60 * 60 * 1000);
  const hours = String(nextHour.getHours()).padStart(2, '0');
  const minutes = String(nextHour.getMinutes()).padStart(2, '0');
  elements.courseTime.value = `${hours}:${minutes}`;
}

async function apiFetch(path, options = {}) {
  const { headers: customHeaders = {}, skipAuthHandling = false, ...fetchOptions } = options;

  const headers = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  if (state.currentUser?.role === 'admin' && state.currentUser?.token) {
    headers['X-Admin-Token'] = state.currentUser.token;
  } else if (state.currentUser?.role === 'driver' && state.currentUser?.token) {
    headers['X-Driver-Token'] = state.currentUser.token;
  }

  const config = {
    ...fetchOptions,
    headers,
  };

  const response = await fetch(`${API_BASE}${path}`, config);

  if (response.status === 204) {
    return null;
  }

  if (response.status === 401 && !skipAuthHandling) {
    const errorPayload = await response.json().catch(() => ({}));
    const message = errorPayload.message || 'Votre session a expiré. Veuillez vous reconnecter.';
    if (state.currentUser) {
      resetAppToLogin({ message });
    }
    throw new Error(message);
  }

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || 'Une erreur est survenue');
  }

  return response.json();
}

function normalizeDriver(driver) {
  return {
    id: driver.id,
    firstName: driver.first_name || driver.firstName,
    lastName: driver.last_name || driver.lastName,
    email: driver.email || null,
    phone: driver.phone || null,
    hasPassword: Boolean(driver.has_password ?? driver.hasPassword ?? false),
  };
}

function normalizeAdmin(admin) {
  const firstName = admin.first_name || admin.firstName;
  const lastName = admin.last_name || admin.lastName;
  return {
    id: admin.id,
    firstName,
    lastName,
    identifier: admin.identifier,
    initials: admin.initials || computeInitials(firstName, lastName),
    createdAt: admin.created_at || admin.createdAt || null,
    role: admin.role || 'standard',
  };
}

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function mapCourse(course) {
  const date = new Date(course.dateTime || course.date_time || course.date);
  const normalized = {
    id: course.id,
    driverId: course.driverId || course.driver_id,
    driverName: course.driverName || course.driver_name || '',
    date,
    departure: course.departure,
    destination: course.destination,
    merchandise: course.merchandise || '',
    comments: course.comments || '',
    status: course.status,
    issueReportedAt: course.issueReportedAt || course.issue_reported_at || null,
    issueReportComment: course.issueReportComment || course.issue_report_comment || '',
    photoUrl: course.photoUrl || course.photo_path || null,
    completionComments: course.completionComments || course.completion_comments || '',
    createdAt: course.createdAt || course.created_at || null,
    updatedAt: course.updatedAt || course.updated_at || null,
    archivedAt: course.archivedAt || course.archived_at || null,
    isArchived: Boolean(course.archivedAt || course.archived_at),
  };

  state.courseCache.set(normalized.id, normalized);
  return normalized;
}

function getCourseStatusMeta(course, { archivedClass = 'bg-gray-200 text-gray-600' } = {}) {
  if (!course) {
    return {
      label: 'Inconnu',
      className: 'bg-gray-200 text-gray-600',
    };
  }

  if (course.isArchived) {
    return {
      label: 'Archivée',
      className: archivedClass,
    };
  }

  if (course.status === 'completed') {
    return {
      label: 'Terminé',
      className: 'bg-green-100 text-green-800',
    };
  }

  if (course.status === 'issue_reported') {
    return {
      label: 'En attente',
      className: 'bg-red-100 text-red-700',
    };
  }

  return {
    label: 'À faire',
    className: 'bg-yellow-100 text-yellow-800',
  };
}

function startOfDay(date) {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
}

function addDays(date, days) {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + days);
  return newDate;
}

function startOfWeek(date) {
  const newDate = startOfDay(date);
  const day = newDate.getDay();
  const diff = (day + 6) % 7;
  newDate.setDate(newDate.getDate() - diff);
  return newDate;
}

function endOfWeek(date) {
  const start = startOfWeek(date);
  return addDays(start, 6);
}

function isSameDay(dateA, dateB) {
  return startOfDay(dateA).getTime() === startOfDay(dateB).getTime();
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date) {
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function computeInitials(firstName, lastName) {
  const first = firstName ? firstName.trim().charAt(0) : '';
  const last = lastName ? lastName.trim().charAt(0) : '';
  const initials = `${first}${last}`.toUpperCase();
  return initials || 'LS';
}

function computeAdminIdentifier(firstName, lastName) {
  if (!firstName || !lastName) {
    return '';
  }
  const trimmedFirst = firstName.trim();
  const trimmedLast = lastName.trim().replace(/\s+/g, '');
  if (!trimmedFirst || !trimmedLast) {
    return '';
  }
  return `${trimmedFirst.charAt(0)}${trimmedLast}`.toLowerCase();
}

function isMobileDevice() {
  if (typeof navigator === 'undefined') {
    return false;
  }
  const coarsePointer = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false;
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || coarsePointer;
}

function lockMobileViewport() {
  if (typeof document === 'undefined') {
    return;
  }

  const viewportMeta = document.getElementById('viewport-meta') || document.querySelector('meta[name="viewport"]');
  if (!viewportMeta) {
    return;
  }

  const baseContent = 'width=device-width, initial-scale=1';
  if (isMobileDevice()) {
    viewportMeta.setAttribute('content', `${baseContent}, maximum-scale=1, user-scalable=no`);
    document.body?.classList.add('mobile-viewport-locked');
  } else {
    viewportMeta.setAttribute('content', baseContent);
    document.body?.classList.remove('mobile-viewport-locked');
  }
}

function handleViewportResize() {
  if (viewportLockTimer) {
    clearTimeout(viewportLockTimer);
  }

  viewportLockTimer = setTimeout(() => {
    lockMobileViewport();
    viewportLockTimer = null;
  }, 150);
}

function applyDisplayPreferences() {
  if (elements.driverDashboard) {
    elements.driverDashboard.dataset.courseLayout = state.displayPreferences.driverLayout;
    elements.driverDashboard.dataset.courseDensity = state.displayPreferences.driverDensity;
    elements.driverDashboard.dataset.weekLayout = state.displayPreferences.driverWeekLayout;
  }

  if (elements.adminDashboard) {
    elements.adminDashboard.dataset.courseLayout = state.displayPreferences.adminLayout;
    elements.adminDashboard.dataset.courseDensity = state.displayPreferences.adminDensity;
  }

  elements.driverLayoutButtons?.forEach((button) => {
    const isActive = button.dataset.driverLayout === state.displayPreferences.driverLayout;
    button.classList.toggle('filter-chip--active', isActive);
  });

  elements.driverDensityButtons?.forEach((button) => {
    const isActive = button.dataset.driverDensity === state.displayPreferences.driverDensity;
    button.classList.toggle('filter-chip--active', isActive);
  });

  elements.driverWeekLayoutButtons?.forEach((button) => {
    const isActive = button.dataset.driverWeekLayout === state.displayPreferences.driverWeekLayout;
    button.classList.toggle('filter-chip--active', isActive);
  });

  elements.adminLayoutButtons?.forEach((button) => {
    const isActive = button.dataset.adminLayout === state.displayPreferences.adminLayout;
    button.classList.toggle('filter-chip--active', isActive);
  });

  elements.adminDensityButtons?.forEach((button) => {
    const isActive = button.dataset.adminDensity === state.displayPreferences.adminDensity;
    button.classList.toggle('filter-chip--active', isActive);
  });
}

function updateDriverCreationAvailability() {
  if (!elements.newCourseTab) {
    return;
  }

  if (state.isAdmin) {
    elements.newCourseTab.classList.remove('hidden', 'pointer-events-none', 'opacity-50');
    elements.newCourseTab.removeAttribute('aria-hidden');
  } else {
    elements.newCourseTab.classList.add('hidden');
    elements.newCourseTab.setAttribute('aria-hidden', 'true');
  }
}

function formatAdminLevel(role) {
  if (role === 'superadmin') {
    return 'Super admin';
  }
  if (role === 'manager') {
    return 'Gestion';
  }
  return 'Standard';
}

function getUserInitials() {
  if (state.currentUser?.initials) {
    return state.currentUser.initials;
  }
  if (!state.currentUser) {
    return 'LS';
  }
  const initials = computeInitials(state.currentUser.firstName, state.currentUser.lastName);
  return initials || 'LS';
}

async function searchDrivers() {
  const searchTerm = elements.lastnameInput.value.trim();
  if (searchTerm.length < 2) {
    hideElement(elements.driverResults);
    elements.driverList.innerHTML = '';
    return;
  }

  try {
    const drivers = await apiFetch(`/drivers?search=${encodeURIComponent(searchTerm)}`);
    state.driverSearchResults = drivers.map(normalizeDriver);
    renderDriverList(state.driverSearchResults);
  } catch (error) {
    console.error(error);
    elements.driverList.innerHTML = '<p class="text-sm text-red-600">Erreur lors de la recherche</p>';
    showElement(elements.driverResults);
  }
}

function renderDriverList(drivers) {
  if (!drivers.length) {
    elements.driverList.innerHTML = '<p class="text-sm text-gray-500">Aucun chauffeur trouvé</p>';
    showElement(elements.driverResults);
    return;
  }

  elements.driverList.innerHTML = '';
  drivers.forEach((driver) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-md transition';
    button.innerHTML = `
      <div class="font-medium">${driver.firstName} ${driver.lastName}</div>
      <div class="text-xs text-gray-500 flex items-center gap-2">
        ${driver.hasPassword ? '<i class="fas fa-lock text-green-600"></i><span>Mot de passe requis</span>' : '<span>Chauffeur</span>'}
      </div>
    `;
    button.addEventListener('click', () => loginAsDriver(driver));
    elements.driverList.appendChild(button);
  });

  showElement(elements.driverResults);
}

async function loginAsDriver(driver, options = {}) {
  const {
    skipPasswordCheck = false,
    initialTab = 'today',
    displayPreferences = null,
    preferencesTab = 'today',
    sessionToken = null,
  } = options;
  const normalizedDriver = normalizeDriver(driver);

  if (!skipPasswordCheck && normalizedDriver.hasPassword) {
    state.pendingDriverLogin = normalizedDriver;
    state.driverPasswordError = '';
    openDriverPasswordModal(normalizedDriver);
    return;
  }

  let resolvedDriver = normalizedDriver;
  let token = sessionToken || null;

  if (!skipPasswordCheck) {
    try {
      const result = await apiFetch('/drivers/login', {
        method: 'POST',
        body: JSON.stringify({ driverId: normalizedDriver.id }),
      });

      resolvedDriver = normalizeDriver({
        id: result.id,
        first_name: result.firstName,
        last_name: result.lastName,
        email: result.email,
        phone: result.phone,
        has_password: result.hasPassword,
      });
      token = result.token || null;
    } catch (error) {
      alert(error.message);
      return;
    }
  }

  await activateDriverSession(resolvedDriver, {
    token,
    initialTab,
    displayPreferences,
    preferencesTab,
  });
}

async function activateDriverSession(driver, options = {}) {
  const {
    token = null,
    initialTab = 'today',
    displayPreferences = null,
    preferencesTab = 'today',
  } = options;

  const normalizedDriver = normalizeDriver(driver);

  state.currentUser = {
    ...normalizedDriver,
    role: 'driver',
    initials: computeInitials(normalizedDriver.firstName, normalizedDriver.lastName),
    token: token || null,
  };

  state.isAdmin = false;
  updateDriverCreationAvailability();
  if (elements.driverNameDisplay) {
    elements.driverNameDisplay.textContent = `${normalizedDriver.firstName} ${normalizedDriver.lastName}`;
  }
  hideElement(elements.loginPage);
  showElement(elements.driverDashboard);
  hideElement(elements.adminDashboard);
  closeDriverPasswordModal();

  state.activeDriverTab = initialTab;
  state.driverPreferences.open = false;
  setDriverPreferencesTab(preferencesTab);
  syncDriverPreferencesPanel();

  if (displayPreferences) {
    state.displayPreferences = {
      ...state.displayPreferences,
      ...displayPreferences,
    };
  }

  applyDisplayPreferences();
  switchTab(initialTab);
  await loadDriverCourses();
  updateMessagingAvailability();
  persistSessionState();
  maybePromptNotificationPermission();
}

function openDriverPasswordModal(driver) {
  if (!elements.driverPasswordModal) {
    const password = window.prompt('Mot de passe chauffeur');
    if (password !== null) {
      state.driverPasswordError = '';
      state.pendingDriverLogin = driver;
      handleDriverPasswordPrompt(password);
    }
    return;
  }

  if (elements.driverPasswordInput) {
    elements.driverPasswordInput.value = '';
  }
  if (elements.driverPasswordError) {
    elements.driverPasswordError.textContent = '';
    elements.driverPasswordError.classList.add('hidden');
  }
  if (elements.driverPasswordName) {
    elements.driverPasswordName.textContent = `${driver.firstName} ${driver.lastName}`;
  }

  showElement(elements.driverPasswordModal);

  setTimeout(() => {
    elements.driverPasswordInput?.focus();
  }, 50);
}

function closeDriverPasswordModal() {
  if (elements.driverPasswordModal) {
    hideElement(elements.driverPasswordModal);
  }
  state.pendingDriverLogin = null;
  state.driverPasswordError = '';
  if (elements.driverPasswordError) {
    elements.driverPasswordError.textContent = '';
    elements.driverPasswordError.classList.add('hidden');
  }
  if (elements.driverPasswordInput) {
    elements.driverPasswordInput.value = '';
  }
}

async function processDriverPassword(password, { inline = false } = {}) {
  if (!state.pendingDriverLogin) {
    return;
  }

  const trimmed = typeof password === 'string' ? password.trim() : '';
  if (!trimmed) {
    if (inline && elements.driverPasswordError) {
      elements.driverPasswordError.textContent = 'Veuillez renseigner le mot de passe chauffeur.';
      elements.driverPasswordError.classList.remove('hidden');
    } else {
      alert('Veuillez renseigner le mot de passe chauffeur.');
    }
    return;
  }

  try {
    const pending = state.pendingDriverLogin;
    const result = await apiFetch('/drivers/login', {
      method: 'POST',
      body: JSON.stringify({ driverId: pending.id, password: trimmed }),
    });

    const normalized = normalizeDriver({
      id: result.id || pending.id,
      first_name: result.firstName || pending.firstName,
      last_name: result.lastName || pending.lastName,
      email: result.email ?? pending.email,
      phone: result.phone ?? pending.phone,
      has_password: result.hasPassword ?? pending.hasPassword,
    });

    await loginAsDriver(normalized, { skipPasswordCheck: true, sessionToken: result.token });
  } catch (error) {
    state.driverPasswordError = error.message;
    if (inline && elements.driverPasswordError) {
      elements.driverPasswordError.textContent = error.message;
      elements.driverPasswordError.classList.remove('hidden');
    } else {
      alert(error.message);
    }
  }
}

async function handleDriverPasswordSubmit(event) {
  event.preventDefault();
  await processDriverPassword(elements.driverPasswordInput?.value || '', { inline: true });
}

async function handleDriverPasswordPrompt(password) {
  await processDriverPassword(password, { inline: false });
}

function setAdminSession(admin, options = {}) {
  const normalized = normalizeAdmin(admin);
  const view = options.view || options.adminView || 'planning';
  const driverTab = options.driverTab || options.activeDriverTab || 'week';
  const settingsTab = options.settingsTab || 'email';
  const preferencesTab = options.driverPreferencesTab || 'today';
  const displayPreferences = {
    ...state.displayPreferences,
    ...(options.displayPreferences || {}),
  };

  state.currentUser = {
    ...normalized,
    role: 'admin',
    adminLevel: normalized.role || 'standard',
    token: admin.token || state.currentUser?.token || null,
  };
  state.isAdmin = true;
  state.adminFilters = { ...DEFAULT_ADMIN_FILTERS, ...(options.adminFilters || {}) };
  state.archiveFilters = { ...DEFAULT_ARCHIVE_FILTERS, ...(options.archiveFilters || {}) };
  state.displayPreferences = displayPreferences;
  state.settings = {
    emailRecipient: '',
    loaded: false,
    saving: false,
    activeTab: settingsTab,
  };
  state.adminManagementView = options.adminManagementView || 'list';
  state.driverPasswordManagement = { drivers: [], loading: false, editingDriverId: null };
  state.driverManagement.expanded = false;
  state.driverManagement.loading = false;
  state.driverManagement.error = null;
  state.adminDrivers = [];
  state.driverSearchResults = [];
  state.activeDriverTab = driverTab;
  state.driverPreferences.open = false;
  setDriverPreferencesTab(preferencesTab);
  syncDriverPreferencesPanel();
  state.adminOptionsPane = options.adminOptionsPane || state.adminOptionsPane || 'core';

  hideElement(elements.loginPage);
  hideElement(elements.driverDashboard);
  showElement(elements.adminDashboard);
  closeAdminLoginModal();

  updateDriverCreationAvailability();

  applyDisplayPreferences();
  syncAdminFiltersToInputs();

  if (elements.adminIdentifierDisplay) {
    const levelLabel =
      state.currentUser.adminLevel === 'superadmin'
        ? 'Super admin'
        : state.currentUser.adminLevel === 'manager'
        ? 'Gestion'
        : 'Standard';
    elements.adminIdentifierDisplay.textContent = `${state.currentUser.initials} (${state.currentUser.identifier} • ${levelLabel})`;
  }

  resetEmailSettingsStatus();
  renderDriverManagementPanel();
  renderSettingsTabs();
  renderAdminOptionsPane();

  switchAdminView(view);
  updateAdminRangeButtons();
  switchTab(state.activeDriverTab);

  if (elements.archiveMerchandiseFilter) {
    elements.archiveMerchandiseFilter.value = state.archiveFilters.merchandise || 'all';
  }
  if (elements.archivePeriodFilter) {
    elements.archivePeriodFilter.value = state.archiveFilters.period || 'week';
  }
  updateArchivePeriodInputs({ resetValues: false });
  if (state.archiveFilters.period === 'custom') {
    if (elements.archiveFromInput) {
      elements.archiveFromInput.value = state.archiveFilters.from || '';
    }
    if (elements.archiveToInput) {
      elements.archiveToInput.value = state.archiveFilters.to || '';
    }
  }

  loadAdminDrivers();
  loadAdminCourses();
  loadActivityLog();
  loadArchivedCourses();
  loadEmailRecipient();
  if (state.currentUser.adminLevel === 'superadmin') {
    loadAdmins();
  }
  updateMessagingAvailability();
  maybePromptNotificationPermission();
  persistSessionState();
}

function openAdminLoginModal() {
  if (!elements.adminLoginModal) {
    return;
  }
  elements.adminIdentifierInput.value = '';
  if (elements.adminPasswordInput) {
    elements.adminPasswordInput.value = '';
  }
  loadAdmins();
  showElement(elements.adminLoginModal);
}

function closeAdminLoginModal() {
  if (elements.adminLoginModal) {
    hideElement(elements.adminLoginModal);
  }
}

async function handleAdminLogin(event) {
  event.preventDefault();
  const identifier = elements.adminIdentifierInput.value.trim().toLowerCase();
  const password = elements.adminPasswordInput?.value || '';

  if (!identifier) {
    alert("Veuillez renseigner l'identifiant administrateur (initiale + nom).");
    return;
  }

  if (!password) {
    alert('Veuillez renseigner votre mot de passe administrateur.');
    return;
  }

  try {
    const admin = await apiFetch('/admins/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    setAdminSession(admin);
  } catch (error) {
    console.error('Erreur de connexion administrateur', error);
    alert(error.message);
  }
}

async function loadAdmins() {
  try {
    const admins = await apiFetch('/admins');
    state.admins = admins.map(normalizeAdmin);
    if (state.adminEdit.id && !state.admins.some((admin) => admin.id === state.adminEdit.id)) {
      resetAdminEditState();
    }
    renderAdminAccounts();
    renderAdminManagement();
  } catch (error) {
    console.error('Erreur lors du chargement des comptes administrateurs', error);
  }
}

function renderAdminAccounts() {
  if (!elements.adminAccountsList) {
    return;
  }

  elements.adminAccountsList.innerHTML = '';

  if (!state.admins.length) {
    const empty = document.createElement('p');
    empty.className = 'text-sm text-gray-500';
    empty.textContent = 'Aucun compte administrateur enregistré pour le moment.';
    elements.adminAccountsList.appendChild(empty);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'space-y-2';

  state.admins.forEach((admin) => {
    const item = document.createElement('li');
    item.className =
      'flex items-center justify-between bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm';
    item.innerHTML = `
      <div>
        <div class="font-medium text-gray-800">${admin.firstName} ${admin.lastName}</div>
        <div class="text-xs text-gray-500 flex flex-wrap gap-2 items-center">
          <span>Identifiant : <span class="font-mono">${admin.identifier}</span></span>
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">${formatAdminLevel(admin.role)}</span>
        </div>
      </div>
      <button type="button" class="text-blue-600 hover:text-blue-800 text-xs font-medium">Utiliser</button>
    `;

    const useButton = item.querySelector('button');
    useButton.addEventListener('click', () => {
      elements.adminIdentifierInput.value = admin.identifier;
      elements.adminIdentifierInput.focus();
    });

    list.appendChild(item);
  });

  elements.adminAccountsList.appendChild(list);
}

function resetAdminEditState() {
  Object.assign(state.adminEdit, ADMIN_EDIT_DEFAULT);
}

function startAdminEdit(admin) {
  Object.assign(state.adminEdit, {
    id: admin.id,
    firstName: admin.firstName || '',
    lastName: admin.lastName || '',
    identifier: admin.identifier || '',
    role: admin.role || 'standard',
    saving: false,
  });
  renderAdminManagement();
}

function cancelAdminEdit() {
  resetAdminEditState();
  renderAdminManagement();
}

function updateAdminEditField(field, value) {
  if (!state.adminEdit || state.adminEdit.id === null) {
    return;
  }
  state.adminEdit[field] = value;
}

async function handleAdminUpdate(event, adminId) {
  event.preventDefault();

  if (state.adminEdit.id !== adminId) {
    return;
  }

  const firstName = (state.adminEdit.firstName || '').trim();
  const lastName = (state.adminEdit.lastName || '').trim();
  const identifier = (state.adminEdit.identifier || '').trim();
  const role = state.adminEdit.role || 'standard';

  if (!firstName || !lastName || !identifier) {
    setAdminManagementStatus('Veuillez renseigner prénom, nom et identifiant.', true);
    return;
  }

  let finalMessage = '';
  let isError = false;

  try {
    state.adminEdit.saving = true;
    renderAdminManagement();
    setAdminManagementStatus('Mise à jour du compte administrateur...');
    await apiFetch(`/admins/${adminId}`, {
      method: 'PUT',
      body: JSON.stringify({ firstName, lastName, identifier, role }),
    });
    await loadAdmins();
    resetAdminEditState();
    finalMessage = 'Administrateur mis à jour.';
  } catch (error) {
    console.error('Erreur lors de la mise à jour du compte administrateur', error);
    finalMessage = error.message || 'Impossible de mettre à jour cet administrateur.';
    isError = true;
  } finally {
    state.adminEdit.saving = false;
    renderAdminManagement();
    if (finalMessage) {
      setAdminManagementStatus(finalMessage, isError);
    }
  }
}

function renderAdminManagementTabs() {
  const buttons = elements.adminManagementTabButtons;
  if (buttons && buttons.length) {
    buttons.forEach((button) => {
      const tabKey = button.getAttribute('data-admin-management-tab') || 'list';
      const isActive = tabKey === state.adminManagementView;
      if (isActive) {
        button.classList.add('admin-management-tab--active');
      } else {
        button.classList.remove('admin-management-tab--active');
      }
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  const panels = elements.adminManagementPanels;
  if (panels && panels.length) {
    panels.forEach((panel) => {
      const panelKey = panel.getAttribute('data-admin-management-panel') || '';
      if (panelKey === state.adminManagementView) {
        showElement(panel);
      } else {
        hideElement(panel);
      }
    });
  }
}

function setAdminManagementView(view) {
  const normalizedView = view === 'create' ? 'create' : 'list';
  if (state.adminManagementView !== normalizedView) {
    state.adminManagementView = normalizedView;
    if (state.currentUser?.role === 'admin') {
      persistSessionState();
    }
  }

  renderAdminManagementTabs();
}

function renderAdminManagement() {
  if (!elements.adminManagementSection) {
    return;
  }

  if (state.currentUser?.adminLevel !== 'superadmin') {
    hideElement(elements.adminManagementSection);
    return;
  }

  showElement(elements.adminManagementSection);
  renderAdminManagementTabs();

  if (elements.adminManagementStatus) {
    elements.adminManagementStatus.textContent = '';
    elements.adminManagementStatus.classList.add('hidden');
  }

  const listContainer = elements.adminManagementList;
  if (!listContainer) {
    return;
  }

  listContainer.innerHTML = '';

  if (!state.admins.length) {
    const empty = document.createElement('p');
    empty.className = 'text-sm text-gray-500';
    empty.textContent = 'Aucun administrateur enregistré.';
    listContainer.appendChild(empty);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'space-y-3';

  state.admins.forEach((admin) => {
    const isEditing = state.adminEdit.id === admin.id;

    if (isEditing) {
      const item = document.createElement('li');
      item.className = 'border border-gray-200 rounded-md px-4 py-4 bg-white shadow-sm space-y-4';

      const header = document.createElement('div');
      header.className = 'flex flex-wrap items-center gap-2';
      const title = document.createElement('div');
      title.className = 'font-medium text-gray-800';
      title.textContent = `Modifier ${admin.firstName} ${admin.lastName}`;
      header.appendChild(title);

      const roleBadge = document.createElement('span');
      roleBadge.className =
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs';
      roleBadge.textContent = formatAdminLevel(state.adminEdit.role || admin.role);
      header.appendChild(roleBadge);

      item.appendChild(header);

      const form = document.createElement('form');
      form.className = 'grid grid-cols-1 md:grid-cols-2 gap-3';
      form.addEventListener('submit', (event) => handleAdminUpdate(event, admin.id));

      const firstNameField = document.createElement('div');
      const firstNameInputId = `admin-edit-first-${admin.id}`;
      const firstNameLabel = document.createElement('label');
      firstNameLabel.className = 'form-label';
      firstNameLabel.setAttribute('for', firstNameInputId);
      firstNameLabel.textContent = 'Prénom';
      const firstNameInput = document.createElement('input');
      firstNameInput.id = firstNameInputId;
      firstNameInput.type = 'text';
      firstNameInput.required = true;
      firstNameInput.className = 'form-input';
      firstNameInput.value = state.adminEdit.firstName;
      firstNameInput.addEventListener('input', (event) => {
        updateAdminEditField('firstName', event.target.value);
      });
      firstNameField.appendChild(firstNameLabel);
      firstNameField.appendChild(firstNameInput);

      const lastNameField = document.createElement('div');
      const lastNameInputId = `admin-edit-last-${admin.id}`;
      const lastNameLabel = document.createElement('label');
      lastNameLabel.className = 'form-label';
      lastNameLabel.setAttribute('for', lastNameInputId);
      lastNameLabel.textContent = 'Nom';
      const lastNameInput = document.createElement('input');
      lastNameInput.id = lastNameInputId;
      lastNameInput.type = 'text';
      lastNameInput.required = true;
      lastNameInput.className = 'form-input';
      lastNameInput.value = state.adminEdit.lastName;
      lastNameInput.addEventListener('input', (event) => {
        updateAdminEditField('lastName', event.target.value);
      });
      lastNameField.appendChild(lastNameLabel);
      lastNameField.appendChild(lastNameInput);

      const identifierField = document.createElement('div');
      identifierField.className = 'md:col-span-2';
      const identifierInputId = `admin-edit-identifier-${admin.id}`;
      const identifierLabel = document.createElement('label');
      identifierLabel.className = 'form-label';
      identifierLabel.setAttribute('for', identifierInputId);
      identifierLabel.textContent = 'Identifiant de connexion';
      const identifierInput = document.createElement('input');
      identifierInput.id = identifierInputId;
      identifierInput.type = 'text';
      identifierInput.required = true;
      identifierInput.className = 'form-input font-mono';
      identifierInput.autocomplete = 'off';
      identifierInput.value = state.adminEdit.identifier;
      identifierInput.addEventListener('input', (event) => {
        const sanitized = event.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '');
        event.target.value = sanitized;
        updateAdminEditField('identifier', sanitized);
      });
      const identifierHelp = document.createElement('p');
      identifierHelp.className = 'text-xs text-gray-500 mt-1';
      identifierHelp.textContent = 'Utilisé pour se connecter (lettres minuscules, chiffres, ".", "-", "_").';
      identifierField.appendChild(identifierLabel);
      identifierField.appendChild(identifierInput);
      identifierField.appendChild(identifierHelp);

      const roleField = document.createElement('div');
      const roleSelectId = `admin-edit-role-${admin.id}`;
      const roleLabel = document.createElement('label');
      roleLabel.className = 'form-label';
      roleLabel.setAttribute('for', roleSelectId);
      roleLabel.textContent = "Niveau d'accès";
      const roleSelect = document.createElement('select');
      roleSelect.id = roleSelectId;
      roleSelect.className = 'form-input';
      ['manager', 'standard'].forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = formatAdminLevel(value);
        roleSelect.appendChild(option);
      });
      roleSelect.value = state.adminEdit.role || 'standard';
      roleSelect.addEventListener('change', (event) => {
        updateAdminEditField('role', event.target.value);
        roleBadge.textContent = formatAdminLevel(event.target.value);
      });
      roleField.appendChild(roleLabel);
      roleField.appendChild(roleSelect);

      const actionsRow = document.createElement('div');
      actionsRow.className = 'md:col-span-2 flex justify-end gap-2';
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn-secondary';
      cancelBtn.textContent = 'Annuler';
      cancelBtn.addEventListener('click', cancelAdminEdit);

      const submitBtn = document.createElement('button');
      submitBtn.type = 'submit';
      submitBtn.className = 'btn-primary flex items-center';
      submitBtn.disabled = state.adminEdit.saving;
      submitBtn.innerHTML = state.adminEdit.saving
        ? '<i class="fas fa-spinner fa-spin mr-2"></i>Enregistrement...'
        : '<i class="fas fa-save mr-2"></i>Enregistrer';

      actionsRow.appendChild(cancelBtn);
      actionsRow.appendChild(submitBtn);

      form.appendChild(firstNameField);
      form.appendChild(lastNameField);
      form.appendChild(identifierField);
      form.appendChild(roleField);
      form.appendChild(actionsRow);

      item.appendChild(form);
      list.appendChild(item);
      return;
    }

    const item = document.createElement('li');
    item.className =
      'border border-gray-200 rounded-md px-4 py-3 bg-white shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3';

    const info = document.createElement('div');
    info.innerHTML = `
      <div class="font-medium text-gray-800">${admin.firstName} ${admin.lastName}</div>
      <div class="text-xs text-gray-500 flex flex-wrap gap-2 items-center mt-1">
        <span>Identifiant : <span class="font-mono">${admin.identifier}</span></span>
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">${formatAdminLevel(admin.role)}</span>
      </div>
    `;

    const actions = document.createElement('div');
    actions.className = 'flex flex-wrap items-center gap-2';

    if (admin.identifier.toLowerCase() === 'lsaquet') {
      const badge = document.createElement('span');
      badge.className = 'text-xs text-green-600 font-semibold';
      badge.textContent = 'Compte principal';
      actions.appendChild(badge);
    } else {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn-secondary text-xs';
      editBtn.textContent = 'Modifier';
      editBtn.addEventListener('click', () => startAdminEdit(admin));
      actions.appendChild(editBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn-danger text-xs';
      deleteBtn.textContent = 'Supprimer';
      deleteBtn.addEventListener('click', () => handleAdminDeletion(admin.id));
      actions.appendChild(deleteBtn);
    }

    item.appendChild(info);
    item.appendChild(actions);
    list.appendChild(item);
  });

  listContainer.appendChild(list);
}

function resetAppToLogin({ message, silent = false } = {}) {
  const wasAuthenticated = Boolean(state.currentUser);

  state.currentUser = null;
  state.isAdmin = false;
  state.driverSearchResults = [];
  state.adminDrivers = [];
  state.driverCourses = [];
  state.adminCourses = [];
  state.archivedCourses = [];
  state.activeDriverTab = 'today';
  state.adminFilters = { driverId: 'all', range: 'week' };
  state.archiveFilters = { driverId: 'all', merchandise: 'all', period: 'week', from: null, to: null };
  state.settings = {
    emailRecipient: '',
    loaded: false,
    saving: false,
    activeTab: 'email',
  };
  state.adminManagementView = 'list';
  state.adminOptionsPane = 'core';
  state.driverPasswordManagement = { drivers: [], loading: false, editingDriverId: null };
  state.driverManagement.expanded = false;
  state.driverManagement.loading = false;
  state.driverManagement.error = null;
  state.activityLog = [];
  state.courseCache.clear();
  state.driverPreferences = { open: false, activeTab: 'today' };
  setDriverPreferencesTab('today');
  syncDriverPreferencesPanel();
  state.notifications.promptShown = false;
  closeNotificationPrompt();
  resetAdminEditState();
  resetMessagingState();
  updateDriverCreationAvailability();
  if (elements.lastnameInput) {
    elements.lastnameInput.value = '';
  }
  if (elements.driverList) {
    elements.driverList.innerHTML = '';
  }
  hideElement(elements.driverDashboard);
  hideElement(elements.adminDashboard);
  hideElement(elements.courseModal);
  closePhotoModal();
  closeCourseEditor();
  closeDriverPasswordModal();
  closeAdminLoginModal();
  if (elements.adminIdentifierDisplay) {
    elements.adminIdentifierDisplay.textContent = '';
  }
  if (elements.adminPasswordInput) {
    elements.adminPasswordInput.value = '';
  }
  if (elements.adminDriverSelect) {
    elements.adminDriverSelect.value = 'all';
  }
  if (elements.archiveDriverFilter) {
    elements.archiveDriverFilter.value = 'all';
  }
  if (elements.archiveMerchandiseFilter) {
    elements.archiveMerchandiseFilter.value = 'all';
  }
  if (elements.archivePeriodFilter) {
    elements.archivePeriodFilter.value = 'week';
  }
  if (elements.emailRecipientInput) {
    elements.emailRecipientInput.value = '';
  }
  resetEmailSettingsStatus();
  if (elements.adminPasswordForm) {
    elements.adminPasswordForm.reset();
  }
  if (elements.adminPasswordFeedback) {
    elements.adminPasswordFeedback.textContent = '';
    elements.adminPasswordFeedback.classList.add('hidden');
  }
  renderDriverManagementPanel();
  renderSettingsTabs();
  renderAdminOptionsPane();
  state.adminView = 'planning';
  updateAdminRangeButtons();
  updateArchivePeriodInputs();
  showElement(elements.loginPage);
  switchTab('today');
  clearPersistedSession();

  if (message && !silent && wasAuthenticated) {
    setTimeout(() => {
      alert(message);
    }, 50);
  }
}

async function logout(event) {
  if (event?.preventDefault) {
    event.preventDefault();
  }

  const isAdmin = state.currentUser?.role === 'admin' && state.currentUser?.token;
  const isDriver = state.currentUser?.role === 'driver' && state.currentUser?.token;

  if (isAdmin) {
    try {
      await apiFetch('/admins/logout', { method: 'POST', skipAuthHandling: true });
    } catch (error) {
      console.warn('Erreur lors de la fermeture de session administrateur', error);
    }
  }

  if (isDriver) {
    try {
      await apiFetch('/drivers/logout', { method: 'POST', skipAuthHandling: true });
    } catch (error) {
      console.warn('Erreur lors de la fermeture de session chauffeur', error);
    }
  }

  resetAppToLogin();
}

function switchTab(requestedTab) {
  const tab = !state.isAdmin && requestedTab === 'new-course' ? 'week' : requestedTab;
  state.activeDriverTab = tab;
  const tabs = [elements.todayTab, elements.weekTab, elements.newCourseTab];
  tabs.forEach((tabElement) => {
    tabElement.classList.remove('tab-button--active');
    tabElement.classList.add('text-gray-500');
  });

  hideElement(elements.todayCourses);
  hideElement(elements.weekCourses);
  hideElement(elements.newCourseForm);

  if (tab === 'today') {
    elements.todayTab.classList.add('tab-button--active');
    elements.todayTab.classList.remove('text-gray-500');
    showElement(elements.todayCourses);
    renderTodayCourses();
  } else if (tab === 'week') {
    elements.weekTab.classList.add('tab-button--active');
    elements.weekTab.classList.remove('text-gray-500');
    showElement(elements.weekCourses);
    renderWeekCourses();
  } else if (tab === 'new-course') {
    elements.newCourseTab.classList.add('tab-button--active');
    elements.newCourseTab.classList.remove('text-gray-500');
    showElement(elements.newCourseForm);
    elements.adminDriverField.classList.toggle('hidden', !state.isAdmin);
  }

  if (state.currentUser) {
    persistSessionState();
  }
}

function switchAdminView(view) {
  state.adminView = view;

  const configurations = [
    { key: 'planning', tab: elements.adminPlanningTab, panel: elements.adminPlanningView },
    { key: 'archives', tab: elements.adminArchivesTab, panel: elements.adminArchiveView },
    { key: 'settings', tab: elements.adminSettingsTab, panel: elements.adminSettingsView },
  ];

  configurations.forEach(({ key, tab, panel }) => {
    if (!tab || !panel) {
      return;
    }
    if (key === view) {
      showElement(panel);
      tab.classList.add('admin-tab--active');
    } else {
      hideElement(panel);
      tab.classList.remove('admin-tab--active');
    }
  });

  if (view === 'planning') {
    updateAdminRangeButtons();
    renderAdminOptionsPane();
  }

  if (view === 'archives') {
    updateArchivePeriodInputs();
    if (!state.archivedCourses.length) {
      loadArchivedCourses();
    } else {
      renderArchivedCourses();
    }
  }

  if (view === 'settings') {
    ensureSettingsData();
  }

  if (state.currentUser?.role === 'admin') {
    persistSessionState();
  }
}

function renderDriverManagementPanel() {
  if (!elements.driverManagementPanel || !elements.driverManagementToggle) {
    return;
  }

  if (state.driverManagement.expanded) {
    showElement(elements.driverManagementPanel);
    elements.driverManagementToggle.textContent = 'Masquer la gestion des chauffeurs';
    elements.driverManagementToggle.setAttribute('aria-expanded', 'true');
  } else {
    hideElement(elements.driverManagementPanel);
    elements.driverManagementToggle.textContent = 'Afficher la gestion des chauffeurs';
    elements.driverManagementToggle.setAttribute('aria-expanded', 'false');
  }
}

function renderAdminOptionsPane() {
  if (!elements.adminPaneButtons?.length || !elements.adminPanes?.length) {
    return;
  }

  const activePane = state.adminOptionsPane || 'core';

  elements.adminPaneButtons.forEach((button) => {
    const paneKey = button.getAttribute('data-admin-pane') || 'core';
    const controlsId = `admin-pane-${paneKey}`;
    const isActive = paneKey === activePane;
    button.classList.toggle('admin-subtab--active', isActive);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    button.setAttribute('aria-controls', controlsId);
    button.setAttribute('tabindex', isActive ? '0' : '-1');
  });

  elements.adminPanes.forEach((panel) => {
    const paneKey = panel.id?.replace('admin-pane-', '') || panel.getAttribute('data-admin-pane') || 'core';
    const isActive = paneKey === activePane;
    if (isActive) {
      panel.classList.add('admin-pane--active');
      panel.classList.remove('hidden');
      panel.removeAttribute('aria-hidden');
    } else {
      panel.classList.remove('admin-pane--active');
      panel.classList.add('hidden');
      panel.setAttribute('aria-hidden', 'true');
    }
  });
}

function setAdminOptionsPane(pane) {
  const normalized = pane || 'core';
  if (state.adminOptionsPane !== normalized) {
    state.adminOptionsPane = normalized;
  }
  renderAdminOptionsPane();
}

function updateAdminRangeButtons() {
  if (!elements.adminRangeButtons) {
    return;
  }
  elements.adminRangeButtons.forEach((button) => {
    const range = button.getAttribute('data-admin-range');
    if (range === state.adminFilters.range) {
      button.classList.add('filter-chip--active');
    } else {
      button.classList.remove('filter-chip--active');
    }
  });
  updateAdminDateInputs();
}

function renderSettingsTabs() {
  if (elements.settingsTabButtons) {
    elements.settingsTabButtons.forEach((button) => {
      const tabKey = button.getAttribute('data-settings-tab');
      const isAdminTab = tabKey === 'admins';
      if (isAdminTab && state.currentUser?.adminLevel !== 'superadmin') {
        button.classList.add('hidden');
      } else {
        button.classList.remove('hidden');
      }

      if (tabKey === state.settings.activeTab) {
        button.classList.add('settings-tab--active');
      } else {
        button.classList.remove('settings-tab--active');
      }
    });
  }

  if (elements.settingsPanels) {
    elements.settingsPanels.forEach((panel) => {
      const panelKey = panel.getAttribute('data-settings-panel');
      const isAdminPanel = panelKey === 'admins';
      if (isAdminPanel && state.currentUser?.adminLevel !== 'superadmin') {
        hideElement(panel);
        return;
      }
      if (panelKey === state.settings.activeTab) {
        showElement(panel);
      } else {
        hideElement(panel);
      }
    });
  }

  if (state.currentUser?.adminLevel === 'superadmin') {
    renderAdminManagementTabs();
  }
}

function ensureSettingsData(tab = state.settings.activeTab) {
  if (!state.isAdmin) {
    return;
  }

  if (tab === 'email') {
    loadEmailRecipient();
  } else if (tab === 'drivers') {
    loadDriverCredentials();
  } else if (tab === 'admins' && state.currentUser?.adminLevel === 'superadmin') {
    if (!state.admins.length) {
      loadAdmins();
    } else {
      renderAdminManagement();
    }
  }
}

function setSettingsTab(tab) {
  if (tab === 'admins' && state.currentUser?.adminLevel !== 'superadmin') {
    return;
  }

  if (state.settings.activeTab !== tab) {
    state.settings.activeTab = tab;
    renderSettingsTabs();
    if (state.currentUser?.role === 'admin') {
      persistSessionState();
    }
  }

  ensureSettingsData(tab);
}

async function loadDriverCourses() {
  if (!state.currentUser) {
    return;
  }

  const today = startOfDay(new Date());
  const pastWindow = addDays(today, -7);
  const nextWeek = addDays(today, 7);
  const params = new URLSearchParams({
    driverId: state.currentUser.id,
    from: pastWindow.toISOString(),
    to: nextWeek.toISOString(),
  });
  params.append('archived', 'all');

  try {
    const courses = await apiFetch(`/courses?${params.toString()}`);
    state.driverCourses = courses.map(mapCourse);
    renderTodayCourses();
    renderWeekCourses();
  } catch (error) {
    console.error('Erreur lors du chargement des courses chauffeur', error);
  }
}

async function loadAdminDrivers({ force = false } = {}) {
  if (state.driverManagement.loading && !force) {
    return;
  }

  state.driverManagement.loading = true;
  state.driverManagement.error = null;
  renderDriverManagement();

  try {
    const drivers = await apiFetch('/drivers');
    state.adminDrivers = drivers.map(normalizeDriver);
    const selectedDriverFilter = state.adminFilters.driverId || 'all';

    elements.adminDriverSelect.innerHTML = '<option value="all">Tous les chauffeurs</option>';
    elements.adminDriverPicker.innerHTML = '<option value="">Sélectionnez un chauffeur</option>';
    elements.courseEditorDriver.innerHTML = '<option value="">Sélectionnez un chauffeur</option>';
    if (elements.archiveDriverFilter) {
      elements.archiveDriverFilter.innerHTML = '<option value="all">Tous les chauffeurs</option>';
    }

    state.adminDrivers.forEach((driver) => {
      const label = `${driver.firstName} ${driver.lastName}`;
      const option = document.createElement('option');
      option.value = driver.id;
      option.textContent = label;
      elements.adminDriverSelect.appendChild(option);

      const pickerOption = option.cloneNode(true);
      elements.adminDriverPicker.appendChild(pickerOption);

      const editorOption = option.cloneNode(true);
      elements.courseEditorDriver.appendChild(editorOption);

      if (elements.archiveDriverFilter) {
        const archiveOption = option.cloneNode(true);
        elements.archiveDriverFilter.appendChild(archiveOption);
      }
    });

    elements.adminDriverSelect.value = selectedDriverFilter;
    if (elements.archiveDriverFilter) {
      elements.archiveDriverFilter.value = state.archiveFilters.driverId || 'all';
    }
  } catch (error) {
    console.error('Erreur lors du chargement des chauffeurs', error);
    state.driverManagement.error = error.message || 'Impossible de récupérer les chauffeurs.';
  } finally {
    state.driverManagement.loading = false;
    renderDriverManagement();
  }
}

function renderDriverManagement() {
  if (!elements.driverListContainer) {
    return;
  }

  elements.driverListContainer.innerHTML = '';

  if (state.driverManagement.loading) {
    const loading = document.createElement('p');
    loading.className = 'text-sm text-gray-500';
    loading.textContent = 'Chargement des chauffeurs...';
    elements.driverListContainer.appendChild(loading);
    return;
  }

  if (state.driverManagement.error) {
    const error = document.createElement('p');
    error.className = 'text-sm text-red-600';
    error.textContent = state.driverManagement.error;
    elements.driverListContainer.appendChild(error);
    return;
  }

  if (!state.adminDrivers.length) {
    const empty = document.createElement('p');
    empty.className = 'text-sm text-gray-500';
    empty.textContent = 'Aucun chauffeur enregistré.';
    elements.driverListContainer.appendChild(empty);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'divide-y divide-gray-200';

  state.adminDrivers.forEach((driver) => {
    const item = document.createElement('li');
    item.className = 'flex items-center justify-between py-2';
    item.innerHTML = `
      <div>
        <div class="text-sm font-medium text-gray-800">${driver.firstName} ${driver.lastName}</div>
        ${driver.email ? `<div class="text-xs text-gray-500">${driver.email}</div>` : ''}
      </div>
      <button type="button" class="text-red-600 hover:text-red-800 text-sm font-medium">Supprimer</button>
    `;

    const deleteButton = item.querySelector('button');
    deleteButton.addEventListener('click', () => handleDeleteDriver(driver.id));
    list.appendChild(item);
  });

  elements.driverListContainer.appendChild(list);
}

async function handleAddDriver(event) {
  event.preventDefault();

  const firstName = elements.driverFirstNameInput.value.trim();
  const lastName = elements.driverLastNameInput.value.trim();
  const email = elements.driverEmailInput.value.trim();

  if (!firstName || !lastName) {
    alert('Veuillez renseigner un prénom et un nom.');
    return;
  }

  try {
    await apiFetch('/drivers', {
      method: 'POST',
      body: JSON.stringify({ firstName, lastName, email: email || null }),
    });

    elements.driverManagementForm.reset();
    await loadAdminDrivers({ force: true });
    await loadAdminCourses();
  } catch (error) {
    console.error('Erreur lors de l\'ajout du chauffeur', error);
    alert(error.message);
  }
}

async function handleDeleteDriver(driverId) {
  if (!confirm('Supprimer ce chauffeur supprimera également ses courses associées. Continuer ?')) {
    return;
  }

  try {
    await apiFetch(`/drivers/${driverId}`, { method: 'DELETE' });
    await loadAdminDrivers({ force: true });
    await loadAdminCourses();
    await loadArchivedCourses();
    await loadActivityLog();
  } catch (error) {
    console.error('Erreur lors de la suppression du chauffeur', error);
    alert(error.message);
  }
}

async function archiveCourse(courseId) {
  if (!confirm('Êtes-vous sûr de vouloir archiver cette course ?')) {
    return;
  }
  try {
    await apiFetch(`/courses/${courseId}/archive`, {
      method: 'POST',
      body: JSON.stringify({ user: getUserInitials() }),
    });
    await loadAdminCourses();
    await loadArchivedCourses();
    await loadActivityLog();
  } catch (error) {
    console.error("Erreur lors de l'archivage de la course", error);
    alert(error.message);
  }
}

async function unarchiveCourse(courseId) {
  if (!confirm('Restaurer cette course archivée ?')) {
    return;
  }
  try {
    await apiFetch(`/courses/${courseId}/unarchive`, {
      method: 'POST',
      body: JSON.stringify({ user: getUserInitials() }),
    });
    await loadAdminCourses();
    await loadArchivedCourses();
    await loadActivityLog();
  } catch (error) {
    console.error('Erreur lors de la restauration de la course', error);
    alert(error.message);
  }
}

function resolveAdminRange() {
  const today = startOfDay(new Date());
  let from = null;
  let to = null;

  switch (state.adminFilters.range) {
    case 'day':
      from = today;
      to = addDays(today, 1);
      break;
    case 'week':
      from = addDays(today, -3);
      to = addDays(today, 4);
      break;
    case 'month': {
      const start = new Date(today);
      start.setDate(1);
      from = startOfDay(start);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      to = startOfDay(end);
      break;
    }
    case 'custom': {
      if (state.adminFilters.from) {
        const start = startOfDay(new Date(state.adminFilters.from));
        if (!Number.isNaN(start.getTime())) {
          from = start;
        }
      }
      if (state.adminFilters.to) {
        const end = startOfDay(new Date(state.adminFilters.to));
        if (!Number.isNaN(end.getTime())) {
          to = addDays(end, 1);
        }
      }
      break;
    }
    default:
      break;
  }

  return { from, to };
}

function updateAdminDateInputs() {
  const isCustom = state.adminFilters.range === 'custom';
  if (elements.adminFromInput) {
    elements.adminFromInput.disabled = !isCustom;
    elements.adminFromInput.value = isCustom && state.adminFilters.from ? state.adminFilters.from : '';
  }
  if (elements.adminToInput) {
    elements.adminToInput.disabled = !isCustom;
    elements.adminToInput.value = isCustom && state.adminFilters.to ? state.adminFilters.to : '';
  }
}

function syncAdminFiltersToInputs() {
  if (elements.adminDriverSelect) {
    elements.adminDriverSelect.value = state.adminFilters.driverId || 'all';
  }
  if (elements.adminStatusFilter) {
    elements.adminStatusFilter.value = state.adminFilters.status || 'all';
  }
  if (elements.adminMerchandiseFilter) {
    elements.adminMerchandiseFilter.value = state.adminFilters.merchandise || 'all';
  }
  if (elements.adminIssueFilter) {
    elements.adminIssueFilter.value = state.adminFilters.issue || 'all';
  }
  if (elements.adminPhotoFilter) {
    elements.adminPhotoFilter.value = state.adminFilters.hasPhoto || 'all';
  }
  if (elements.adminSearchFilter) {
    elements.adminSearchFilter.value = state.adminFilters.search || '';
  }
  updateAdminRangeButtons();
}

async function loadAdminCourses() {
  const params = new URLSearchParams();
  const { from, to } = resolveAdminRange();

  if (from) {
    params.append('from', from.toISOString());
  }
  if (to) {
    params.append('to', to.toISOString());
  }

  if (state.adminFilters.driverId && state.adminFilters.driverId !== 'all') {
    params.append('driverId', state.adminFilters.driverId);
  }

  if (state.adminFilters.status && state.adminFilters.status !== 'all') {
    params.append('status', state.adminFilters.status);
  }

  if (state.adminFilters.merchandise && state.adminFilters.merchandise !== 'all') {
    params.append('merchandise', state.adminFilters.merchandise);
  }

  if (state.adminFilters.issue === 'issues') {
    params.append('issue', 'reported');
  } else if (state.adminFilters.issue === 'clear') {
    params.append('issue', 'none');
  }

  if (state.adminFilters.hasPhoto === 'with') {
    params.append('hasPhoto', 'true');
  } else if (state.adminFilters.hasPhoto === 'without') {
    params.append('hasPhoto', 'false');
  }

  if (state.adminFilters.search) {
    params.append('search', state.adminFilters.search);
  }

  try {
    const courses = await apiFetch(`/courses?${params.toString()}`);
    state.adminCourses = courses.map(mapCourse);
    renderAdminCourses();
  } catch (error) {
    console.error('Erreur lors du chargement des courses', error);
  }
}

function handleAdminRangeClick(event) {
  const button = event.target.closest('[data-admin-range]');
  if (!button) {
    return;
  }
  const range = button.getAttribute('data-admin-range') || 'all';
  state.adminFilters.range = range;
  if (range !== 'custom') {
    state.adminFilters.from = null;
    state.adminFilters.to = null;
  }
  updateAdminRangeButtons();
  loadAdminCourses();
  persistSessionState();
}

function handleAdminStatusChange() {
  if (!elements.adminStatusFilter) {
    return;
  }
  state.adminFilters.status = elements.adminStatusFilter.value || 'all';
  loadAdminCourses();
  persistSessionState();
}

function handleAdminMerchandiseChange() {
  if (!elements.adminMerchandiseFilter) {
    return;
  }
  state.adminFilters.merchandise = elements.adminMerchandiseFilter.value || 'all';
  loadAdminCourses();
  persistSessionState();
}

function handleAdminIssueChange() {
  if (!elements.adminIssueFilter) {
    return;
  }
  state.adminFilters.issue = elements.adminIssueFilter.value || 'all';
  loadAdminCourses();
  persistSessionState();
}

function handleAdminPhotoChange() {
  if (!elements.adminPhotoFilter) {
    return;
  }
  state.adminFilters.hasPhoto = elements.adminPhotoFilter.value || 'all';
  loadAdminCourses();
  persistSessionState();
}

function handleAdminDateChange() {
  if (!elements.adminFromInput || !elements.adminToInput) {
    return;
  }
  if (state.adminFilters.range !== 'custom') {
    state.adminFilters.range = 'custom';
  }
  state.adminFilters.from = elements.adminFromInput.value || null;
  state.adminFilters.to = elements.adminToInput.value || null;
  updateAdminRangeButtons();
  loadAdminCourses();
  persistSessionState();
}

function scheduleAdminSearch() {
  if (adminSearchTimer) {
    clearTimeout(adminSearchTimer);
  }
  adminSearchTimer = setTimeout(() => {
    loadAdminCourses();
    persistSessionState();
  }, 300);
}

function handleAdminSearchInput(event) {
  state.adminFilters.search = event.target.value.trim();
  scheduleAdminSearch();
}

function resetAdminFilters() {
  state.adminFilters = { ...DEFAULT_ADMIN_FILTERS };
  syncAdminFiltersToInputs();
  loadAdminCourses();
  persistSessionState();
}

function handleDriverLayoutChange(event) {
  const layout = event.target.getAttribute('data-driver-layout');
  if (!layout) {
    return;
  }
  state.displayPreferences.driverLayout = layout;
  applyDisplayPreferences();
  renderTodayCourses();
  renderWeekCourses();
  persistSessionState();
}

function handleDriverDensityChange(event) {
  const density = event.target.getAttribute('data-driver-density');
  if (!density) {
    return;
  }
  state.displayPreferences.driverDensity = density;
  applyDisplayPreferences();
  renderTodayCourses();
  renderWeekCourses();
  persistSessionState();
}

function handleDriverWeekLayoutChange(event) {
  const layout = event.target.getAttribute('data-driver-week-layout');
  if (!layout) {
    return;
  }
  state.displayPreferences.driverWeekLayout = layout;
  applyDisplayPreferences();
  renderWeekCourses();
  persistSessionState();
}

function syncDriverPreferencesPanel() {
  if (!elements.driverPreferencesPanel) {
    return;
  }
  if (elements.driverPreferencesToggle) {
    elements.driverPreferencesToggle.setAttribute('aria-expanded', state.driverPreferences.open ? 'true' : 'false');
  }
  if (state.driverPreferences.open) {
    showElement(elements.driverPreferencesPanel);
    elements.driverPreferencesPanel.setAttribute('aria-hidden', 'false');
  } else {
    hideElement(elements.driverPreferencesPanel);
    elements.driverPreferencesPanel.setAttribute('aria-hidden', 'true');
  }
}

function setDriverPreferencesTab(tabKey) {
  const normalized = tabKey === 'week' ? 'week' : 'today';
  state.driverPreferences.activeTab = normalized;

  if (elements.driverPreferencesTabs) {
    elements.driverPreferencesTabs.forEach((button) => {
      const tab = button.getAttribute('data-driver-preferences-tab');
      const isActive = tab === normalized;
      button.classList.toggle('driver-preferences__tab--active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  if (elements.driverPreferencesSections) {
    elements.driverPreferencesSections.forEach((section) => {
      const tab = section.getAttribute('data-driver-preferences-panel');
      const isActive = tab === normalized;
      section.classList.toggle('hidden', !isActive);
      section.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });
  }
}

function openDriverPreferences() {
  state.driverPreferences.open = true;
  syncDriverPreferencesPanel();
}

function closeDriverPreferences() {
  state.driverPreferences.open = false;
  syncDriverPreferencesPanel();
}

function toggleDriverPreferences() {
  state.driverPreferences.open = !state.driverPreferences.open;
  syncDriverPreferencesPanel();
}

function hasNotificationSupport() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

function getNotificationSettings() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Préférences de notification illisibles', error);
    return null;
  }
}

function saveNotificationSettings(settings) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn("Impossible d'enregistrer les préférences de notification", error);
  }
}

function recordNotificationStatus(status) {
  const payload = {
    status,
    updatedAt: Date.now(),
  };
  saveNotificationSettings(payload);
  if (status === 'granted' || status === 'denied' || status === 'default') {
    state.notifications.lastKnownPermission = status;
  }
}

function openNotificationPrompt() {
  if (!elements.notificationPrompt) {
    return;
  }
  showElement(elements.notificationPrompt);
  elements.notificationPrompt.setAttribute('aria-hidden', 'false');
}

function closeNotificationPrompt() {
  if (!elements.notificationPrompt) {
    return;
  }
  hideElement(elements.notificationPrompt);
  elements.notificationPrompt.setAttribute('aria-hidden', 'true');
  state.notifications.promptShown = false;
}

function handleNotificationDismiss() {
  recordNotificationStatus('dismissed');
  closeNotificationPrompt();
}

async function requestNotificationPermission() {
  if (!hasNotificationSupport()) {
    closeNotificationPrompt();
    return;
  }

  try {
    const result = await Notification.requestPermission();
    recordNotificationStatus(result);
    closeNotificationPrompt();
    state.notifications.lastKnownPermission = result;
    if (result === 'granted') {
      try {
        new Notification('Notifications activées', {
          body: "Vous recevrez les alertes importantes même si l'application est en arrière-plan.",
        });
      } catch (error) {
        console.warn('Notification locale indisponible', error);
      }
    }
  } catch (error) {
    console.warn('Erreur lors de la demande de permission de notification', error);
    closeNotificationPrompt();
  }
}

function shouldPromptNotification() {
  if (!hasNotificationSupport()) {
    return false;
  }
  const permission = Notification.permission;
  state.notifications.lastKnownPermission = permission;
  if (permission === 'granted' || permission === 'denied') {
    recordNotificationStatus(permission);
    return false;
  }
  const settings = getNotificationSettings();
  if (settings?.status && settings.status !== 'granted') {
    return false;
  }
  return true;
}

function maybePromptNotificationPermission() {
  if (state.notifications.promptShown) {
    return;
  }
  if (!elements.notificationPrompt) {
    return;
  }
  if (!shouldPromptNotification()) {
    return;
  }
  state.notifications.promptShown = true;
  recordNotificationStatus('prompted');
  openNotificationPrompt();
}

function canShowRealtimeNotification() {
  return hasNotificationSupport() && Notification.permission === 'granted';
}

function maybeShowRealtimeNotification(event) {
  if (!canShowRealtimeNotification()) {
    return;
  }
  if (typeof document !== 'undefined' && !document.hidden) {
    return;
  }
  if (!event || !event.type || !state.currentUser) {
    return;
  }

  let title = '';
  let body = '';

  if (event.type === 'courses:changed' && state.currentUser.role === 'driver') {
    if (event.payload?.driverId && event.payload.driverId !== state.currentUser.id) {
      return;
    }
    const action = event.payload?.action;
    if (['created', 'restored', 'reopened'].includes(action)) {
      title = 'Nouvelle course disponible';
      body = "Une nouvelle course vient d'être ajoutée à votre planning.";
    } else if (action === 'updated') {
      title = 'Course mise à jour';
      body = 'Consultez les changements apportés à votre prochaine course.';
    } else if (action === 'deleted') {
      title = 'Course supprimée';
      body = 'Une course a été retirée de votre planning.';
    } else {
      return;
    }
  } else if (event.type === 'messages:new') {
    const { payload } = event;
    const { senderType, driverId, message } = payload || {};
    const text = typeof message?.body === 'string' ? message.body.trim() : '';
    const preview = text.length > 140 ? `${text.slice(0, 137)}…` : text;

    if (state.currentUser.role === 'driver') {
      if (Number(driverId) !== state.currentUser.id || senderType !== 'admin') {
        return;
      }
      title = "Nouveau message de l'administration";
      body = preview || 'Un nouveau message est disponible.';
    } else if (state.isAdmin && senderType === 'driver') {
      const driver = state.adminDrivers.find((d) => d.id === Number(driverId));
      const name = driver ? `${driver.firstName || ''} ${driver.lastName || ''}`.trim() || 'Un chauffeur' : 'Un chauffeur';
      title = `${name} vous a écrit`;
      body = preview || "Un message vient d'être reçu.";
    } else {
      return;
    }
  }

  if (!title) {
    return;
  }

  try {
    new Notification(title, body ? { body } : undefined);
  } catch (error) {
    console.warn("Impossible d'afficher la notification en temps réel", error);
  }
}

function handleGlobalKeyDown(event) {
  if (event.key !== 'Escape') {
    return;
  }
  let handled = false;
  if (state.driverPreferences.open) {
    closeDriverPreferences();
    handled = true;
  }
  if (elements.notificationPrompt && !elements.notificationPrompt.classList.contains('hidden')) {
    handleNotificationDismiss();
    handled = true;
  }
  if (handled) {
    event.preventDefault();
  }
}

function handleAdminLayoutChange(event) {
  const layout = event.target.getAttribute('data-admin-layout');
  if (!layout) {
    return;
  }
  state.displayPreferences.adminLayout = layout;
  applyDisplayPreferences();
  renderAdminCourses();
  persistSessionState();
}

function handleAdminDensityChange(event) {
  const density = event.target.getAttribute('data-admin-density');
  if (!density) {
    return;
  }
  state.displayPreferences.adminDensity = density;
  applyDisplayPreferences();
  renderAdminCourses();
  persistSessionState();
}

async function exportCourses(format, context = 'planning') {
  if (!state.isAdmin || !state.currentUser?.token) {
    alert('Seul un administrateur connecté peut exporter les courses.');
    return;
  }

  const params = new URLSearchParams();
  params.append('format', format);

  if (context === 'archives') {
    params.append('archived', 'true');
    if (state.archiveFilters.driverId && state.archiveFilters.driverId !== 'all') {
      params.append('driverId', state.archiveFilters.driverId);
    }
    if (state.archiveFilters.merchandise && state.archiveFilters.merchandise !== 'all') {
      params.append('merchandise', state.archiveFilters.merchandise);
    }
    const { from, to } = resolveArchiveRange();
    if (from) {
      params.append('from', from.toISOString());
    }
    if (to) {
      params.append('to', to.toISOString());
    }
  } else {
    const { from, to } = resolveAdminRange();
    if (from) {
      params.append('from', from.toISOString());
    }
    if (to) {
      params.append('to', to.toISOString());
    }
    if (state.adminFilters.driverId && state.adminFilters.driverId !== 'all') {
      params.append('driverId', state.adminFilters.driverId);
    }
    if (state.adminFilters.status && state.adminFilters.status !== 'all') {
      params.append('status', state.adminFilters.status);
    }
    if (state.adminFilters.merchandise && state.adminFilters.merchandise !== 'all') {
      params.append('merchandise', state.adminFilters.merchandise);
    }
    if (state.adminFilters.issue === 'issues') {
      params.append('issue', 'reported');
    } else if (state.adminFilters.issue === 'clear') {
      params.append('issue', 'none');
    }
    if (state.adminFilters.hasPhoto === 'with') {
      params.append('hasPhoto', 'true');
    } else if (state.adminFilters.hasPhoto === 'without') {
      params.append('hasPhoto', 'false');
    }
    if (state.adminFilters.search) {
      params.append('search', state.adminFilters.search);
    }
  }

  try {
    const response = await fetch(`${API_BASE}/courses/export?${params.toString()}`, {
      headers: {
        'X-Admin-Token': state.currentUser.token,
      },
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message || "Impossible de générer l'export." );
    }

    const blob = await response.blob();
    let filename = format === 'pdf' ? 'export-courses.pdf' : 'export-courses.xlsx';
    const disposition = response.headers.get('content-disposition');
    if (disposition) {
      const match = /filename="?([^";]+)"?/i.exec(disposition);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500);
  } catch (error) {
    console.error("Erreur lors de l'export", error);
    alert(error.message || "Impossible de générer l'export.");
  }
}

async function loadActivityLog() {
  try {
    const logItems = await apiFetch('/activity?limit=100');
    state.activityLog = logItems;
    renderActivityLog();
  } catch (error) {
    console.error("Erreur lors du chargement du journal d'activité", error);
  }
}

function resolveArchiveRange() {
  const today = startOfDay(new Date());
  let from = null;
  let to = null;

  switch (state.archiveFilters.period) {
    case 'day':
      from = today;
      to = addDays(today, 1);
      break;
    case 'week':
      from = today;
      to = addDays(today, 7);
      break;
    case 'month': {
      from = today;
      const end = new Date(today);
      end.setMonth(end.getMonth() + 1);
      to = end;
      break;
    }
    case 'custom': {
      if (state.archiveFilters.from) {
        from = startOfDay(new Date(state.archiveFilters.from));
      }
      if (state.archiveFilters.to) {
        const end = startOfDay(new Date(state.archiveFilters.to));
        to = addDays(end, 1);
      }
      break;
    }
    case 'all':
    default:
      break;
  }

  return { from, to };
}

async function loadArchivedCourses() {
  if (!state.isAdmin) {
    return;
  }

  const params = new URLSearchParams({ archived: 'true' });
  if (state.archiveFilters.driverId && state.archiveFilters.driverId !== 'all') {
    params.append('driverId', state.archiveFilters.driverId);
  }

  const { from, to } = resolveArchiveRange();
  if (from) {
    params.append('from', from.toISOString());
  }
  if (to) {
    params.append('to', to.toISOString());
  }

  try {
    const courses = await apiFetch(`/courses?${params.toString()}`);
    let mapped = courses.map(mapCourse).filter((course) => course.archivedAt);

    if (state.archiveFilters.merchandise && state.archiveFilters.merchandise !== 'all') {
      const target = state.archiveFilters.merchandise.toLowerCase();
      mapped = mapped.filter((course) => (course.merchandise || '').toLowerCase() === target);
    }

    state.archivedCourses = mapped;
    renderArchivedCourses();
  } catch (error) {
    console.error("Erreur lors du chargement des courses archivées", error);
  }
}

function renderArchivedCourses() {
  if (!elements.archiveList || !elements.noArchive) {
    return;
  }

  elements.archiveList.innerHTML = '';

  if (!state.archivedCourses.length) {
    showElement(elements.noArchive);
    return;
  }

  hideElement(elements.noArchive);

  state.archivedCourses
    .slice()
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .forEach((course) => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-gray-50';
      row.innerHTML = `
        <td class="px-4 py-3 text-sm sm:whitespace-nowrap" data-label="Date">${course.date.toLocaleDateString('fr-FR')}</td>
        <td class="px-4 py-3 text-sm" data-label="Chauffeur">${course.driverName || ''}</td>
        <td class="px-4 py-3" data-label="Trajet">
          <div class="flex-1">
            <div class="font-medium text-gray-800">${course.departure} → ${course.destination}</div>
            <div class="text-xs text-gray-500 mt-1">${formatTime(course.date)}</div>
          </div>
        </td>
        <td class="px-4 py-3 text-sm" data-label="Marchandise">${course.merchandise || '—'}</td>
        <td class="px-4 py-3 text-sm text-gray-600" data-label="Commentaires">${course.comments || '—'}</td>
        <td class="px-4 py-3" data-label="Actions">
          <div class="flex flex-wrap gap-2 sm:justify-end">
            <button type="button" class="btn-tertiary text-xs" data-action="restore">Restaurer</button>
            <button type="button" class="btn-danger text-xs" data-action="delete">Supprimer</button>
          </div>
        </td>
      `;

      const restoreBtn = row.querySelector('[data-action="restore"]');
      const deleteBtn = row.querySelector('[data-action="delete"]');

      restoreBtn.addEventListener('click', () => unarchiveCourse(course.id));
      deleteBtn.addEventListener('click', () => deleteCourse(course.id));

      elements.archiveList.appendChild(row);
    });
}

function updateArchivePeriodInputs(options = {}) {
  const { resetValues = true } = options;
  if (!elements.archiveFromInput || !elements.archiveToInput) {
    return;
  }

  const isCustom = state.archiveFilters.period === 'custom';
  elements.archiveFromInput.disabled = !isCustom;
  elements.archiveToInput.disabled = !isCustom;

  if (!isCustom) {
    elements.archiveFromInput.value = '';
    elements.archiveToInput.value = '';
    if (resetValues) {
      state.archiveFilters.from = null;
      state.archiveFilters.to = null;
    }
  } else {
    elements.archiveFromInput.value = state.archiveFilters.from || '';
    elements.archiveToInput.value = state.archiveFilters.to || '';
  }
}

function handleArchivePeriodChange() {
  if (!elements.archivePeriodFilter) {
    return;
  }
  state.archiveFilters.period = elements.archivePeriodFilter.value || 'week';
  updateArchivePeriodInputs();
  loadArchivedCourses();
  if (state.currentUser?.role === 'admin') {
    persistSessionState();
  }
}

function handleArchiveFiltersChange() {
  if (elements.archiveDriverFilter) {
    state.archiveFilters.driverId = elements.archiveDriverFilter.value || 'all';
  }
  if (elements.archiveMerchandiseFilter) {
    state.archiveFilters.merchandise = elements.archiveMerchandiseFilter.value || 'all';
  }
  loadArchivedCourses();
  if (state.currentUser?.role === 'admin') {
    persistSessionState();
  }
}

function handleArchiveDatesChange() {
  if (!elements.archiveFromInput || !elements.archiveToInput) {
    return;
  }
  state.archiveFilters.from = elements.archiveFromInput.value || null;
  state.archiveFilters.to = elements.archiveToInput.value || null;
  loadArchivedCourses();
  if (state.currentUser?.role === 'admin') {
    persistSessionState();
  }
}

function resetEmailSettingsStatus() {
  if (!elements.emailSettingsStatus) {
    return;
  }
  elements.emailSettingsStatus.textContent = '';
  elements.emailSettingsStatus.classList.add('hidden');
  elements.emailSettingsStatus.classList.remove('text-green-600', 'text-red-600');
}

function showEmailSettingsStatus(message, isError = false) {
  if (!elements.emailSettingsStatus) {
    return;
  }
  elements.emailSettingsStatus.textContent = message;
  elements.emailSettingsStatus.classList.remove('hidden');
  elements.emailSettingsStatus.classList.remove('text-green-600', 'text-red-600');
  elements.emailSettingsStatus.classList.add(isError ? 'text-red-600' : 'text-green-600');
}

async function loadEmailRecipient(force = false) {
  if (!elements.emailSettingsForm) {
    return;
  }

  if (state.settings.loaded && !force) {
    elements.emailRecipientInput.value = state.settings.emailRecipient;
    return;
  }

  try {
    resetEmailSettingsStatus();
    const response = await apiFetch('/settings/email-recipient');
    state.settings.emailRecipient = response.email || '';
    state.settings.loaded = true;
    elements.emailRecipientInput.value = state.settings.emailRecipient;
  } catch (error) {
    console.error('Erreur lors du chargement de la configuration email', error);
    showEmailSettingsStatus(error.message || "Impossible de charger l'adresse email.", true);
  }
}

async function handleEmailSettingsSubmit(event) {
  event.preventDefault();

  if (!elements.emailSettingsForm) {
    return;
  }

  if (state.settings.saving) {
    return;
  }

  const email = elements.emailRecipientInput?.value.trim() || '';

  if (!email) {
    showEmailSettingsStatus('Veuillez renseigner une adresse email.', true);
    return;
  }

  const submitButton = elements.emailSettingsForm.querySelector('button[type="submit"]');

  try {
    state.settings.saving = true;
    resetEmailSettingsStatus();
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.classList.add('opacity-50', 'cursor-not-allowed');
    }

    const response = await apiFetch('/settings/email-recipient', {
      method: 'PUT',
      body: JSON.stringify({ email }),
    });

    state.settings.emailRecipient = response.email || email;
    state.settings.loaded = true;

    elements.emailRecipientInput.value = state.settings.emailRecipient;

    showEmailSettingsStatus('Adresse email mise à jour avec succès.');
  } catch (error) {
    console.error("Erreur lors de l'enregistrement de l'adresse email", error);
    showEmailSettingsStatus(error.message || "Impossible de mettre à jour l'adresse email.", true);
  } finally {
    state.settings.saving = false;
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }
}

async function loadDriverCredentials() {
  if (!elements.driverPasswordList || state.driverPasswordManagement.loading) {
    return;
  }

  try {
    state.driverPasswordManagement.loading = true;
    const drivers = await apiFetch('/drivers/credentials');
    state.driverPasswordManagement.drivers = drivers.map(normalizeDriver);
    renderDriverCredentials();
  } catch (error) {
    console.error('Erreur lors du chargement des mots de passe chauffeurs', error);
    if (elements.driverPasswordList) {
      elements.driverPasswordList.innerHTML = `<p class="text-sm text-red-600">${
        error.message || 'Impossible de récupérer les chauffeurs.'
      }</p>`;
    }
  } finally {
    state.driverPasswordManagement.loading = false;
  }
}

function renderDriverCredentials() {
  if (!elements.driverPasswordList) {
    return;
  }

  const drivers = state.driverPasswordManagement.drivers || [];
  elements.driverPasswordList.innerHTML = '';

  if (!drivers.length) {
    if (elements.driverPasswordEmpty) {
      elements.driverPasswordEmpty.classList.remove('hidden');
    }
    return;
  }

  if (elements.driverPasswordEmpty) {
    elements.driverPasswordEmpty.classList.add('hidden');
  }

  const list = document.createElement('ul');
  list.className = 'space-y-3';

  drivers.forEach((driver) => {
    const item = document.createElement('li');
    item.className =
      'border border-gray-200 rounded-md px-4 py-3 bg-white shadow-sm flex flex-col gap-3';

    const statusBadge = driver.hasPassword
      ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs"><i class="fas fa-lock"></i> Protégé</span>'
      : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs"><i class="fas fa-unlock"></i> Aucun mot de passe</span>';

    item.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div class="font-medium text-gray-800">${driver.firstName} ${driver.lastName}</div>
          <div class="text-xs text-gray-500 mt-1 flex items-center gap-2">${statusBadge}</div>
        </div>
      </div>
    `;

    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'flex flex-col sm:flex-row sm:items-center gap-2';

    if (state.driverPasswordManagement.editingDriverId === driver.id) {
      const form = document.createElement('form');
      form.className = 'flex flex-col sm:flex-row gap-2 w-full';
      form.innerHTML = `
        <input type="password" class="form-input sm:flex-1" placeholder="Nouveau mot de passe" required />
        <div class="flex gap-2">
          <button type="submit" class="btn-primary text-sm">Enregistrer</button>
          <button type="button" data-action="cancel" class="btn-secondary text-sm">Annuler</button>
        </div>
      `;
      form.addEventListener('submit', (event) => handleDriverPasswordSave(event, driver.id));
      const cancelButton = form.querySelector('[data-action="cancel"]');
      cancelButton.addEventListener('click', () => {
        state.driverPasswordManagement.editingDriverId = null;
        renderDriverCredentials();
      });
      actionsContainer.appendChild(form);
      setTimeout(() => {
        form.querySelector('input')?.focus();
      }, 0);
    } else {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn-secondary text-xs sm:text-sm';
      editBtn.textContent = driver.hasPassword ? 'Modifier le mot de passe' : 'Définir un mot de passe';
      editBtn.addEventListener('click', () => {
        state.driverPasswordManagement.editingDriverId = driver.id;
        renderDriverCredentials();
      });
      actionsContainer.appendChild(editBtn);

      if (driver.hasPassword) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn-danger text-xs sm:text-sm';
        removeBtn.textContent = 'Supprimer le mot de passe';
        removeBtn.addEventListener('click', () => removeDriverPassword(driver.id));
        actionsContainer.appendChild(removeBtn);
      }
    }

    item.appendChild(actionsContainer);
    list.appendChild(item);
  });

  elements.driverPasswordList.appendChild(list);
}

async function handleDriverPasswordSave(event, driverId) {
  event.preventDefault();
  const input = event.target.querySelector('input[type="password"]');
  const newPassword = input?.value || '';

  if (!newPassword.trim()) {
    alert('Veuillez renseigner un mot de passe.');
    return;
  }

  try {
    await apiFetch(`/drivers/${driverId}/password`, {
      method: 'PUT',
      body: JSON.stringify({ newPassword }),
    });
    state.driverPasswordManagement.editingDriverId = null;
    await loadDriverCredentials();
  } catch (error) {
    console.error('Erreur lors de la mise à jour du mot de passe chauffeur', error);
    alert(error.message);
  }
}

async function removeDriverPassword(driverId) {
  if (!confirm('Supprimer le mot de passe de ce chauffeur ?')) {
    return;
  }

  try {
    await apiFetch(`/drivers/${driverId}/password`, { method: 'DELETE' });
    state.driverPasswordManagement.editingDriverId = null;
    await loadDriverCredentials();
  } catch (error) {
    console.error('Erreur lors de la suppression du mot de passe chauffeur', error);
    alert(error.message);
  }
}

function setAdminManagementStatus(message, isError = false) {
  if (!elements.adminManagementStatus) {
    if (isError) {
      alert(message);
    } else {
      console.info(message);
    }
    return;
  }

  elements.adminManagementStatus.textContent = message;
  elements.adminManagementStatus.classList.remove('hidden');
  elements.adminManagementStatus.classList.remove('text-green-600', 'text-red-600');
  elements.adminManagementStatus.classList.add(isError ? 'text-red-600' : 'text-green-600');
}

async function handleAdminCreation(event) {
  event.preventDefault();

  if (!elements.adminManagementCreateForm) {
    return;
  }

  const firstName = elements.adminManagementFirstName?.value.trim() || '';
  const lastName = elements.adminManagementLastName?.value.trim() || '';
  const password = elements.adminManagementPassword?.value || '';
  const role = elements.adminManagementRole?.value || 'standard';

  if (!firstName || !lastName || !password) {
    setAdminManagementStatus('Veuillez renseigner prénom, nom et mot de passe.', true);
    return;
  }

  try {
    setAdminManagementStatus('Création du compte administrateur en cours...');
    await apiFetch('/admins', {
      method: 'POST',
      body: JSON.stringify({ firstName, lastName, password, role }),
    });
    setAdminManagementStatus('Administrateur créé avec succès. Identifiant visible dans la liste.');
    elements.adminManagementCreateForm.reset();
    await loadAdmins();
  } catch (error) {
    console.error('Erreur lors de la création du compte administrateur', error);
    setAdminManagementStatus(error.message || 'Impossible de créer ce compte administrateur.', true);
  }
}

async function handleAdminDeletion(adminId) {
  if (!confirm('Supprimer cet administrateur ?')) {
    return;
  }

  try {
    await apiFetch(`/admins/${adminId}`, { method: 'DELETE' });
    setAdminManagementStatus('Administrateur supprimé.');
    await loadAdmins();
  } catch (error) {
    console.error('Erreur lors de la suppression du compte administrateur', error);
    setAdminManagementStatus(error.message || 'Impossible de supprimer cet administrateur.', true);
  }
}

function setAdminPasswordFeedback(message, isError = false) {
  if (!elements.adminPasswordFeedback) {
    if (isError) {
      alert(message);
    } else {
      console.info(message);
    }
    return;
  }

  elements.adminPasswordFeedback.textContent = message;
  elements.adminPasswordFeedback.classList.remove('hidden');
  elements.adminPasswordFeedback.classList.remove('text-green-600', 'text-red-600');
  elements.adminPasswordFeedback.classList.add(isError ? 'text-red-600' : 'text-green-600');
}

async function handleAdminPasswordChange(event) {
  event.preventDefault();

  if (!state.currentUser?.id) {
    return;
  }

  const currentPassword = elements.adminPasswordCurrent?.value || '';
  const newPassword = elements.adminPasswordNew?.value || '';

  if (!newPassword.trim()) {
    setAdminPasswordFeedback('Veuillez renseigner un nouveau mot de passe.', true);
    return;
  }

  try {
    await apiFetch(`/admins/${state.currentUser.id}/password`, {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setAdminPasswordFeedback('Mot de passe mis à jour avec succès.');
    elements.adminPasswordForm?.reset();
  } catch (error) {
    console.error('Erreur lors du changement de mot de passe administrateur', error);
    setAdminPasswordFeedback(error.message || 'Impossible de mettre à jour le mot de passe.', true);
  }
}

function renderTodayCourses() {
  elements.todayList.innerHTML = '';
  const today = startOfDay(new Date());
  const courses = state.driverCourses.filter((course) => isSameDay(course.date, today));

  if (!courses.length) {
    showElement(elements.noCoursesToday);
    return;
  }

  hideElement(elements.noCoursesToday);

  const layout = state.displayPreferences.driverLayout || 'cards';
  const commentsClass = state.displayPreferences.driverDensity === 'contrast' ? 'text-gray-800 font-medium' : 'text-gray-600';

  if (layout === 'list') {
    elements.todayList.className = 'today-list divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white';
  } else {
    elements.todayList.className = 'today-list space-y-3';
  }

  courses
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .forEach((course) => {
      const container = document.createElement('div');
      const archived = course.isArchived;
      const departure = escapeHtml(course.departure || '');
      const destination = escapeHtml(course.destination || '');
      const merchandise = escapeHtml(course.merchandise || '');
      const comments = course.comments ? escapeHtml(course.comments) : '';
      const issueComment = course.issueReportComment ? escapeHtml(course.issueReportComment) : '';
      const statusMeta = getCourseStatusMeta(course);

      if (layout === 'list') {
        container.className = `course-item course-item--list px-4 py-3 ${
          archived ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
        }`;
        container.classList.add('animate-fade-up');
        container.setAttribute('aria-disabled', archived ? 'true' : 'false');
        container.innerHTML = `
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
            <div class="flex-1 min-w-0">
              <div class="font-medium text-gray-800 truncate">${departure} → ${destination}</div>
              <div class="text-sm text-gray-500 mt-1">${formatTime(course.date)} • ${merchandise || '—'}</div>
              ${comments ? `<div class="mt-2 text-sm ${commentsClass}"><i class="fas fa-comment mr-1"></i> ${comments}</div>` : ''}
              ${course.status === 'issue_reported' && issueComment
                ? `<div class="mt-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">Problème signalé : ${issueComment}</div>`
                : ''}
            </div>
            <div class="flex flex-col items-stretch sm:items-end gap-2 min-w-[150px]">
              <span class="px-2 py-1 text-xs rounded-full ${statusMeta.className} text-center">${statusMeta.label}</span>
              ${
                !archived && course.status !== 'completed' && course.status !== 'issue_reported'
                  ? '<button type="button" class="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 issue-toggle"><i class="fas fa-exclamation-triangle mr-2"></i>Signaler</button>'
                  : ''
              }
            </div>
          </div>
        `;
      } else {
        const baseClasses = 'course-item bg-white p-4 rounded-lg shadow-sm border border-gray-200 transition';
        container.className = `${baseClasses} ${archived ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`;
        container.classList.add('animate-fade-up');
        container.setAttribute('aria-disabled', archived ? 'true' : 'false');
        container.innerHTML = `
          <div class="flex justify-between items-start">
            <div>
              <div class="font-medium">${departure} → ${destination}</div>
              <div class="text-sm text-gray-500 mt-1">${formatTime(course.date)} • ${merchandise || '—'}</div>
            </div>
            <span class="px-2 py-1 text-xs rounded-full ${statusMeta.className}">
              ${statusMeta.label}
            </span>
          </div>
          ${comments ? `<div class="mt-2 text-sm ${commentsClass}"><i class="fas fa-comment mr-1"></i> ${comments}</div>` : ''}
        `;

        if (course.status === 'issue_reported' && issueComment) {
          const issueNotice = document.createElement('div');
          issueNotice.className = 'mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2';
          issueNotice.textContent = `Problème signalé : ${issueComment || 'Détail non renseigné'}`;
          container.appendChild(issueNotice);
        }

        if (!archived && course.status !== 'completed' && course.status !== 'issue_reported') {
          const buttonWrapper = document.createElement('div');
          buttonWrapper.className = 'mt-3 flex justify-end';
          const issueButton = document.createElement('button');
          issueButton.type = 'button';
          issueButton.className = 'inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 issue-toggle';
          issueButton.innerHTML = '<i class="fas fa-exclamation-triangle mr-2"></i>Signaler un problème';
          issueButton.addEventListener('click', (event) => {
            event.stopPropagation();
            openCourseIssueModal(course.id);
          });
          buttonWrapper.appendChild(issueButton);
          container.appendChild(buttonWrapper);
        }
      }

      if (!archived) {
        container.addEventListener('click', () => openCourseModal(course.id));
      }

      if (layout === 'list') {
        const issueButton = container.querySelector('.issue-toggle');
        if (issueButton) {
          issueButton.addEventListener('click', (event) => {
            event.stopPropagation();
            openCourseIssueModal(course.id);
          });
        }
      }

      elements.todayList.appendChild(container);
    });
}

function renderWeekCourses() {
  elements.weekList.innerHTML = '';
  if (elements.weekSchedule) {
    elements.weekSchedule.innerHTML = '';
  }

  if (!state.driverCourses.length) {
    showElement(elements.noCoursesWeek);
    if (elements.weekTableWrapper) {
      hideElement(elements.weekTableWrapper);
    }
    if (elements.weekSchedule) {
      hideElement(elements.weekSchedule);
    }
    return;
  }

  hideElement(elements.noCoursesWeek);

  const layout = state.displayPreferences.driverWeekLayout || 'list';

  if (layout === 'schedule') {
    if (elements.weekTableWrapper) {
      hideElement(elements.weekTableWrapper);
    }
    if (elements.weekSchedule) {
      showElement(elements.weekSchedule);
      renderWeekSchedule();
    }
    return;
  }

  if (elements.weekTableWrapper) {
    showElement(elements.weekTableWrapper);
  }
  if (elements.weekSchedule) {
    hideElement(elements.weekSchedule);
  }

  state.driverCourses
    .slice()
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .forEach((course) => {
      const row = document.createElement('tr');
      const archived = course.isArchived;
      row.className = `${archived ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'} driver-week-row`;
      row.classList.add('animate-fade-up');
      row.setAttribute('aria-disabled', archived ? 'true' : 'false');

      const statusMeta = getCourseStatusMeta(course, {
        archivedClass: 'bg-gray-300 text-gray-700',
      });
      const dateLabel = formatDate(course.date);
      const departure = escapeHtml(course.departure || '');
      const destination = escapeHtml(course.destination || '');
      const issueText = course.issueReportComment ? escapeHtml(course.issueReportComment) : '';

      row.innerHTML = `
        <td class="px-6 py-4 text-sm sm:whitespace-nowrap" data-label="Date">${dateLabel}</td>
        <td class="px-6 py-4 text-sm" data-label="Départ">${departure}</td>
        <td class="px-6 py-4 text-sm" data-label="Arrivée">${destination}</td>
        <td class="px-6 py-4 text-sm sm:whitespace-nowrap" data-label="Horaire">${formatTime(course.date)}</td>
        <td class="px-6 py-4" data-label="Statut">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span class="px-2 py-1 text-xs rounded-full ${statusMeta.className}">
              ${statusMeta.label}
            </span>
            ${!archived && course.status !== 'completed' && course.status !== 'issue_reported'
              ? '<button type="button" class="issue-button text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1 hover:bg-red-100"><i class="fas fa-exclamation-triangle mr-1"></i>Signaler un problème</button>'
              : ''}
          </div>
        </td>
      `;

      if (!archived) {
        row.addEventListener('click', () => openCourseModal(course.id));
      }

      if (course.status === 'issue_reported' && course.issueReportComment) {
        const detailRow = document.createElement('tr');
        detailRow.className = 'bg-red-50 animate-fade-up';
        const cell = document.createElement('td');
        cell.colSpan = 5;
        cell.className = 'px-6 py-3 text-sm text-red-700 border-t border-red-100';
        const issueLabel = issueText || 'Détail non renseigné';
        cell.innerHTML = `<i class="fas fa-circle-exclamation mr-2"></i>Problème signalé : ${issueLabel}`;
        detailRow.appendChild(cell);
        elements.weekList.appendChild(row);
        elements.weekList.appendChild(detailRow);
      } else {
        elements.weekList.appendChild(row);
      }

      const issueButton = row.querySelector('.issue-button');
      if (issueButton) {
        issueButton.addEventListener('click', (event) => {
          event.stopPropagation();
          openCourseIssueModal(course.id);
        });
      }
    });
}

function renderWeekSchedule() {
  if (!elements.weekSchedule) {
    return;
  }

  const today = new Date();
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);
  const scheduleContainer = elements.weekSchedule;
  scheduleContainer.innerHTML = '';

  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const coursesByDay = new Map();

  state.driverCourses.forEach((course) => {
    const courseDate = startOfDay(course.date);
    if (courseDate < weekStart || courseDate > weekEnd) {
      return;
    }
    const key = courseDate.toISOString();
    if (!coursesByDay.has(key)) {
      coursesByDay.set(key, []);
    }
    coursesByDay.get(key).push(course);
  });

  days.forEach((dayDate) => {
    const dayKey = startOfDay(dayDate).toISOString();
    const dayCourses = (coursesByDay.get(dayKey) || []).slice().sort((a, b) => a.date.getTime() - b.date.getTime());

    const dayCard = document.createElement('div');
    dayCard.className = 'week-schedule-day animate-fade-up';

    const header = document.createElement('div');
    header.className = 'week-schedule-day__header';
    const dayLabel = dayDate.toLocaleDateString('fr-FR', { weekday: 'long' });
    const dateLabel = dayDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    header.innerHTML = `
      <div>
        <div class="week-schedule-day__title">${dayLabel}</div>
        <div class="week-schedule-day__date">${dateLabel}</div>
      </div>
      ${isSameDay(dayDate, today) ? "<span class='text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full'>Aujourd'hui</span>" : ''}
    `;
    dayCard.appendChild(header);

    if (!dayCourses.length) {
      const empty = document.createElement('div');
      empty.className = 'week-schedule-slot week-schedule-slot__empty';
      empty.textContent = 'Aucune course planifiée';
      dayCard.appendChild(empty);
    } else {
      dayCourses.forEach((course) => {
        const archived = course.isArchived;
        const departure = escapeHtml(course.departure || '');
        const destination = escapeHtml(course.destination || '');
        const merchandise = escapeHtml(course.merchandise || '');
        const comments = course.comments ? escapeHtml(course.comments) : '';
        const issueComment = course.issueReportComment ? escapeHtml(course.issueReportComment) : '';
        const statusMeta = getCourseStatusMeta(course, {
          archivedClass: 'bg-gray-300 text-gray-700',
        });

        const slot = document.createElement('div');
        slot.className = `week-schedule-slot ${archived ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`;
        slot.setAttribute('role', archived ? 'group' : 'button');
        slot.setAttribute('aria-disabled', archived ? 'true' : 'false');
        slot.innerHTML = `
          <div class="flex items-center justify-between text-xs text-gray-500">
            <span><i class="fas fa-clock mr-1"></i>${formatTime(course.date)}</span>
            <span class="px-2 py-0.5 rounded-full ${statusMeta.className}">${statusMeta.label}</span>
          </div>
          <div class="week-schedule-slot__route">${departure} → ${destination}</div>
          <div class="week-schedule-slot__meta">${merchandise || '—'}</div>
          ${comments ? `<div class="text-xs text-gray-600"><i class="fas fa-comment mr-1"></i>${comments}</div>` : ''}
          ${issueComment ? `<div class="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1"><i class="fas fa-circle-exclamation mr-1"></i>${issueComment}</div>` : ''}
        `;

        if (!archived) {
          slot.addEventListener('click', () => openCourseModal(course.id));
        }

        if (!archived && course.status !== 'completed' && course.status !== 'issue_reported') {
          const action = document.createElement('button');
          action.type = 'button';
          action.className = 'mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700';
          action.innerHTML = '<i class="fas fa-exclamation-triangle"></i>Signaler un problème';
          action.addEventListener('click', (event) => {
            event.stopPropagation();
            openCourseIssueModal(course.id);
          });
          slot.appendChild(action);
        }

        dayCard.appendChild(slot);
      });
    }

    scheduleContainer.appendChild(dayCard);
  });
}

function renderAdminCourses() {
  elements.adminWeekList.innerHTML = '';

  if (elements.adminCardList) {
    elements.adminCardList.innerHTML = '';
  }

  if (!state.adminCourses.length) {
    showElement(elements.noCoursesAdmin);
    if (elements.adminCardList) {
      hideElement(elements.adminCardList);
    }
    return;
  }

  hideElement(elements.noCoursesAdmin);

  const layout = state.displayPreferences.adminLayout || 'table';
  if (layout === 'cards' && elements.adminCardList) {
    hideElement(elements.adminTableWrapper);
    showElement(elements.adminCardList);
  } else {
    showElement(elements.adminTableWrapper);
    hideElement(elements.adminCardList);
  }

  state.adminCourses
    .slice()
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .forEach((course) => {
      const statusMeta = getCourseStatusMeta(course, {
        archivedClass: 'bg-gray-200 text-gray-600',
      });
      const dateLabel = formatDate(course.date);
      const timeLabel = formatTime(course.date);
      const driverName = escapeHtml(course.driverName || '');
      const departure = escapeHtml(course.departure || '');
      const destination = escapeHtml(course.destination || '');
      const merchandise = escapeHtml(course.merchandise || '');
      const comments = course.comments ? escapeHtml(course.comments) : '';

      if (layout === 'cards' && elements.adminCardList) {
        const card = document.createElement('div');
        card.className = 'admin-course-card bg-white border border-gray-200 rounded-lg p-4 shadow-sm';
        card.innerHTML = `
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="text-sm text-gray-500">${dateLabel} • ${timeLabel}</div>
              <div class="font-semibold text-gray-900 mt-1">${driverName || '—'}</div>
              <div class="text-sm text-gray-700 mt-2">${departure} → ${destination}</div>
              <div class="text-xs text-gray-500 mt-1">${merchandise || '—'}</div>
              ${comments ? `<div class="mt-2 text-sm text-gray-600"><i class="fas fa-comment mr-1"></i> ${comments}</div>` : ''}
            </div>
            <div class="flex flex-col items-end gap-2">
              <span class="px-2 py-1 text-xs rounded-full ${statusMeta.className}">${statusMeta.label}</span>
              ${course.status === 'issue_reported'
                ? '<span class="text-xs font-medium text-red-700"><i class="fas fa-circle-exclamation mr-1"></i>Problème en attente</span>'
                : ''}
            </div>
          </div>
          <div class="flex flex-wrap gap-3 mt-4 justify-end" data-card-actions>
            ${course.status === 'completed'
              ? '<button class="text-emerald-600 hover:text-emerald-800" data-action="reopen" aria-label="Remettre la course en attente"><i class="fas fa-rotate-left"></i></button>'
              : ''}
            <button class="text-amber-600 hover:text-amber-800" data-action="archive" aria-label="Archiver la course">
              <i class="fas fa-box-archive"></i>
            </button>
            <button class="text-blue-600 hover:text-blue-900" data-action="edit" aria-label="Modifier la course">
              <i class="fas fa-edit"></i>
            </button>
            <button class="text-red-600 hover:text-red-900" data-action="delete" aria-label="Supprimer la course">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        `;

        const actions = card.querySelector('[data-card-actions]');
        const reopenBtn = actions?.querySelector('[data-action="reopen"]');
        const archiveBtn = actions?.querySelector('[data-action="archive"]');
        const editBtn = actions?.querySelector('[data-action="edit"]');
        const deleteBtn = actions?.querySelector('[data-action="delete"]');

        reopenBtn?.addEventListener('click', (event) => {
          event.stopPropagation();
          reopenCourse(course.id);
        });
        archiveBtn?.addEventListener('click', (event) => {
          event.stopPropagation();
          archiveCourse(course.id);
        });
        editBtn?.addEventListener('click', (event) => {
          event.stopPropagation();
          openCourseEditor(course);
        });
        deleteBtn?.addEventListener('click', (event) => {
          event.stopPropagation();
          deleteCourse(course.id);
        });

        card.addEventListener('click', () => openCourseModal(course.id));
        elements.adminCardList.appendChild(card);
        return;
      }

      const row = document.createElement('tr');
      row.className = 'hover:bg-gray-50 admin-course-row';

      row.innerHTML = `
        <td class="px-6 py-4 text-sm" data-label="Chauffeur">${driverName}</td>
        <td class="px-6 py-4 text-sm sm:whitespace-nowrap" data-label="Date">${dateLabel}</td>
        <td class="px-6 py-4 text-sm" data-label="Départ">${departure}</td>
        <td class="px-6 py-4 text-sm" data-label="Arrivée">${destination}</td>
        <td class="px-6 py-4 text-sm sm:whitespace-nowrap" data-label="Horaire">${timeLabel}</td>
        <td class="px-6 py-4" data-label="Statut">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span class="px-2 py-1 text-xs rounded-full ${statusMeta.className}">
              ${statusMeta.label}
            </span>
            ${course.status === 'issue_reported'
              ? '<span class="text-xs font-medium text-red-700"><i class="fas fa-circle-exclamation mr-1"></i>Problème en attente</span>'
              : ''}
          </div>
        </td>
        <td class="px-6 py-4 text-sm font-medium sm:text-right" data-label="Actions">
          <div class="flex flex-wrap gap-3 sm:justify-end">
            ${course.status === 'completed'
              ? '<button class="text-emerald-600 hover:text-emerald-800" data-action="reopen" aria-label="Remettre la course en attente"><i class="fas fa-rotate-left"></i></button>'
              : ''}
            <button class="text-amber-600 hover:text-amber-800" data-action="archive" aria-label="Archiver la course">
              <i class="fas fa-box-archive"></i>
            </button>
            <button class="text-blue-600 hover:text-blue-900" data-action="edit" aria-label="Modifier la course">
              <i class="fas fa-edit"></i>
            </button>
            <button class="text-red-600 hover:text-red-900" data-action="delete" aria-label="Supprimer la course">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      `;

      row.addEventListener('click', (event) => {
        const target = event.target.closest('button[data-action]');
        if (target) {
          event.stopPropagation();
          const action = target.dataset.action;
          if (action === 'edit') {
            editCourse(course.id);
          } else if (action === 'archive') {
            archiveCourse(course.id);
          } else if (action === 'delete') {
            deleteCourse(course.id);
          } else if (action === 'reopen') {
            reopenCourse(course.id);
          }
          return;
        }
        openCourseModal(course.id);
      });

      elements.adminWeekList.appendChild(row);
    });
}

function renderActivityLog() {
  elements.activityLogList.innerHTML = '';

  if (!state.activityLog.length) {
    showElement(elements.noActivity);
    return;
  }

  hideElement(elements.noActivity);

  state.activityLog.forEach((item) => {
    const logItem = document.createElement('div');
    logItem.className = 'p-4';

    const date = new Date(item.timestamp);
    const formattedDate = date.toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    const metadata = item.metadata || null;
    const driverSuffix = item.course && item.course.driverName ? ` pour ${item.course.driverName}` : '';
    const courseInfo = item.course
      ? `${item.course.departure || ''} → ${item.course.destination || ''} • ${
          item.course.dateTime ? new Date(item.course.dateTime).toLocaleDateString('fr-FR') : ''
        }`
      : '';

    let bubbleText = item.user;
    let primaryText;

    if (item.action === 'created_completed') {
      const createdBy = metadata?.createdBy || item.user;
      const completedBy = metadata?.completedBy || createdBy;

      if (createdBy && completedBy && createdBy !== completedBy) {
        bubbleText = `${createdBy}/${completedBy}`;
        primaryText = `Créée par ${createdBy} et validée par ${completedBy}${driverSuffix}`;
      } else {
        const actor = completedBy || createdBy || item.user;
        bubbleText = actor;
        primaryText = `Créée et validée par ${actor}${driverSuffix}`;
      }
    } else {
      const actionText =
        item.action === 'created'
          ? 'a créé une course'
          : item.action === 'modified'
          ? 'a modifié une course'
          : item.action === 'completed'
          ? 'a complété une course'
          : item.action === 'deleted'
          ? 'a supprimé une course'
          : item.action === 'archived'
          ? 'a archivé une course'
          : item.action === 'restored'
          ? 'a restauré une course'
          : item.action === 'reopened'
          ? 'a remis une course en attente'
          : item.action === 'issue_reported'
          ? 'a signalé un problème sur une course'
          : item.action;
      primaryText = `${item.user} ${actionText}${driverSuffix}`;
    }

    logItem.innerHTML = `
      <div class="flex items-start">
        <div class="bg-blue-100 text-blue-800 w-8 h-8 rounded-full flex items-center justify-center font-medium mr-3">
          ${bubbleText}
        </div>
        <div class="flex-1">
          <div class="text-sm font-medium text-gray-900">
            ${primaryText}
          </div>
          ${courseInfo ? `<div class="text-sm text-gray-500 mt-1">${courseInfo}</div>` : ''}
          <div class="text-xs text-gray-400 mt-1">${formattedDate}</div>
        </div>
      </div>
    `;

    const content = logItem.querySelector('.flex-1');

    if (state.isAdmin && item.course) {
      const actions = document.createElement('div');
      actions.className = 'flex flex-wrap gap-2 mt-3';

      if (item.course.archivedAt) {
        const restoreBtn = document.createElement('button');
        restoreBtn.type = 'button';
        restoreBtn.className = 'btn-tertiary text-xs';
        restoreBtn.textContent = 'Restaurer';
        restoreBtn.addEventListener('click', () => unarchiveCourse(item.course.id));
        actions.appendChild(restoreBtn);
      } else {
        const archiveBtn = document.createElement('button');
        archiveBtn.type = 'button';
        archiveBtn.className = 'btn-secondary text-xs';
        archiveBtn.textContent = 'Archiver';
        archiveBtn.addEventListener('click', () => archiveCourse(item.course.id));
        actions.appendChild(archiveBtn);
      }

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn-danger text-xs';
      deleteBtn.textContent = 'Supprimer';
      deleteBtn.addEventListener('click', () => deleteCourse(item.course.id));
      actions.appendChild(deleteBtn);

      content.appendChild(actions);
    }

    elements.activityLogList.appendChild(logItem);
  });
}

async function handleAddCourse(event) {
  event.preventDefault();

  if (!state.isAdmin) {
    alert("La création de courses est réservée à l'administration.");
    return;
  }

  try {
    const courseDate = elements.courseDate.value;
    const courseTime = elements.courseTime.value;
    const dateTime = new Date(`${courseDate}T${courseTime}`);

    if (Number.isNaN(dateTime.getTime())) {
      alert('Veuillez renseigner une date et une heure valides.');
      return;
    }

    const payload = {
      driverId: state.isAdmin
        ? Number.parseInt(elements.adminDriverPicker.value, 10)
        : state.currentUser?.id,
      dateTime: dateTime.toISOString(),
      departure: elements.departure.value,
      destination: elements.destination.value,
      merchandise: elements.merchandiseType.value,
      comments: elements.courseComments.value,
      user: getUserInitials(),
    };

    if (!payload.driverId) {
      alert('Veuillez sélectionner un chauffeur.');
      return;
    }

    if (state.currentCourseId) {
      await apiFetch(`/courses/${state.currentCourseId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch('/courses', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    state.currentCourseId = null;
    elements.addCourseForm.reset();
    setDefaultCourseDateTime();

    if (state.isAdmin) {
      await loadAdminCourses();
      await loadActivityLog();
      switchTab('week');
    } else {
      await loadDriverCourses();
      switchTab('today');
    }
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de la course', error);
    alert(error.message);
  }
}

async function editCourse(courseId) {
  try {
    const course = await apiFetch(`/courses/${courseId}`);
    if (state.isAdmin) {
      openCourseEditor(course);
      return;
    }
    state.currentCourseId = course.id;

    const date = new Date(course.dateTime);
    elements.courseDate.value = date.toISOString().split('T')[0];
    elements.courseTime.value = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    elements.departure.value = course.departure;
    elements.destination.value = course.destination;
    elements.merchandiseType.value = course.merchandise || 'Autre';
    elements.courseComments.value = course.comments || '';

    switchTab('new-course');
    hideElement(elements.courseModal);
  } catch (error) {
    console.error('Erreur lors du chargement de la course', error);
    alert(error.message);
  }
}

async function deleteCourse(courseId) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer cette course ?')) {
    return;
  }

  try {
    await apiFetch(`/courses/${courseId}?user=${encodeURIComponent(getUserInitials())}`, {
      method: 'DELETE',
    });

    if (state.isAdmin) {
      await loadAdminCourses();
      await loadArchivedCourses();
      await loadActivityLog();
    } else {
      await loadDriverCourses();
    }

    hideElement(elements.courseModal);
  } catch (error) {
    console.error('Erreur lors de la suppression de la course', error);
    alert(error.message);
  }
}

async function reopenCourse(courseId) {
  if (!state.isAdmin) {
    return;
  }

  if (!confirm('Remettre cette course en attente ?')) {
    return;
  }

  try {
    await apiFetch(`/courses/${courseId}/reopen`, {
      method: 'POST',
      body: JSON.stringify({ user: getUserInitials() }),
    });

    await loadAdminCourses();
    await loadActivityLog();
    await loadArchivedCourses();
    hideElement(elements.courseModal);
  } catch (error) {
    console.error('Erreur lors de la remise en attente de la course', error);
    alert(error.message);
  }
}

function openCourseEditor(course) {
  hideElement(elements.courseModal);
  state.currentCourseId = course ? course.id : null;
  const selectedFilter = elements.adminDriverSelect.value;
  const baseDate = course ? new Date(course.dateTime) : new Date();

  elements.courseEditorTitle.textContent = course
    ? `Modifier la course #${course.id}`
    : 'Nouvelle course';

  if (course) {
    elements.courseEditorDriver.value = course.driverId;
  } else if (selectedFilter && selectedFilter !== 'all') {
    elements.courseEditorDriver.value = selectedFilter;
  } else {
    elements.courseEditorDriver.value = '';
  }

  elements.courseEditorDate.value = baseDate.toISOString().split('T')[0];
  elements.courseEditorTime.value = `${String(baseDate.getHours()).padStart(2, '0')}:${String(baseDate.getMinutes()).padStart(2, '0')}`;
  elements.courseEditorDeparture.value = course ? course.departure : '';
  elements.courseEditorDestination.value = course ? course.destination : '';
  elements.courseEditorMerchandise.value = course ? course.merchandise || 'Autre' : 'Céréales';
  elements.courseEditorComments.value = course ? course.comments || '' : '';

  showElement(elements.courseEditorModal);
}

function closeCourseEditor() {
  elements.courseEditorForm.reset();
  state.currentCourseId = null;
  hideElement(elements.courseEditorModal);
}

async function handleCourseEditorSubmit(event) {
  event.preventDefault();

  try {
    const driverId = Number.parseInt(elements.courseEditorDriver.value, 10);
    if (!driverId) {
      alert('Veuillez sélectionner un chauffeur.');
      return;
    }

    const date = elements.courseEditorDate.value;
    const time = elements.courseEditorTime.value;
    const dateTime = new Date(`${date}T${time}`);
    if (Number.isNaN(dateTime.getTime())) {
      alert('Veuillez renseigner une date et une heure valides.');
      return;
    }

    const payload = {
      driverId,
      dateTime: dateTime.toISOString(),
      departure: elements.courseEditorDeparture.value,
      destination: elements.courseEditorDestination.value,
      merchandise: elements.courseEditorMerchandise.value,
      comments: elements.courseEditorComments.value,
      user: getUserInitials(),
    };

    if (state.currentCourseId) {
      await apiFetch(`/courses/${state.currentCourseId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch('/courses', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    closeCourseEditor();
    await loadAdminCourses();
    await loadActivityLog();
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de la course', error);
    alert(error.message);
  }
}

async function openCourseModal(courseId) {
  try {
    const course = await apiFetch(`/courses/${courseId}`);
    const isArchived = Boolean(course.archivedAt);

    if (!state.isAdmin && isArchived) {
      return;
    }

    state.currentCourseId = course.id;
    state.pendingCompletionComments = '';

    const date = new Date(course.dateTime);
    const formattedDate = date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    elements.modalTitle.textContent = `Course #${course.id}`;

    elements.modalContent.innerHTML = `
      <div class="space-y-4">
        ${isArchived ? `
          <div class="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
            Course archivée : visible à titre d'information uniquement.
          </div>
        ` : ''}
        <div>
          <h4 class="text-sm font-medium text-gray-500">Chauffeur</h4>
          <p class="mt-1 text-sm text-gray-900">${course.driverName || ''}</p>
        </div>
        <div>
          <h4 class="text-sm font-medium text-gray-500">Date et heure</h4>
          <p class="mt-1 text-sm text-gray-900">${formattedDate} à ${formatTime(date)}</p>
        </div>
        <div>
          <h4 class="text-sm font-medium text-gray-500">Trajet</h4>
          <p class="mt-1 text-sm text-gray-900">${course.departure} → ${course.destination}</p>
        </div>
        <div>
          <h4 class="text-sm font-medium text-gray-500">Type de marchandise</h4>
          <p class="mt-1 text-sm text-gray-900">${course.merchandise || 'Non renseigné'}</p>
        </div>
        ${course.comments ? `
          <div>
            <h4 class="text-sm font-medium text-gray-500">Commentaires</h4>
            <p class="mt-1 text-sm text-gray-900">${course.comments}</p>
          </div>
        ` : ''}
        ${course.status === 'issue_reported' ? `
          <div class="rounded-md border border-red-200 bg-red-50 px-3 py-2">
            <div class="text-sm font-medium text-red-700 flex items-center gap-2">
              <i class="fas fa-circle-exclamation"></i>
              <span>Problème signalé</span>
            </div>
            <p class="mt-2 text-sm text-red-700">${escapeHtml(course.issueReportComment || 'Commentaire non renseigné')}</p>
            ${course.issueReportedAt ? `<p class="mt-1 text-xs text-red-500">Signalé le ${new Date(course.issueReportedAt).toLocaleString('fr-FR')}</p>` : ''}
          </div>
        ` : ''}
        ${course.status === 'completed' ? `
          <div>
            <h4 class="text-sm font-medium text-gray-500">Photo du bon</h4>
            ${course.photoUrl ? `<img src="${course.photoUrl}?${Date.now()}" alt="Bon de transport" class="mt-2 w-full h-auto rounded-md border border-gray-200" />` : '<p class="mt-1 text-sm text-gray-500">Aucune photo</p>'}
          </div>
          <div>
            <h4 class="text-sm font-medium text-gray-500">Commentaires de livraison</h4>
            <p class="mt-1 text-sm text-gray-900">${course.completionComments || 'Aucun commentaire'}</p>
          </div>
        ` : !state.isAdmin && !isArchived ? `
          <div class="pt-4">
            <label class="block text-sm font-medium text-gray-700 mb-1" for="completion-comments">Commentaires de livraison</label>
            <textarea id="completion-comments" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" rows="3" placeholder="Ajoutez des commentaires sur la livraison..."></textarea>
          </div>
        ` : ''}
      </div>
    `;

    elements.modalActions.innerHTML = '';

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition';
    closeButton.textContent = 'Fermer';
    closeButton.addEventListener('click', () => hideElement(elements.courseModal));
    elements.modalActions.appendChild(closeButton);

    if (state.isAdmin) {
      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition';
      editButton.innerHTML = '<i class="fas fa-edit mr-1"></i> Modifier';
      editButton.addEventListener('click', () => editCourse(course.id));
      elements.modalActions.appendChild(editButton);

      if (course.status === 'completed') {
        const reopenButton = document.createElement('button');
        reopenButton.type = 'button';
        reopenButton.className = 'px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition';
        reopenButton.innerHTML = '<i class="fas fa-rotate-left mr-1"></i> Remettre en attente';
        reopenButton.addEventListener('click', () => reopenCourse(course.id));
        elements.modalActions.appendChild(reopenButton);
      }

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition';
      deleteButton.innerHTML = '<i class="fas fa-trash mr-1"></i> Supprimer';
      deleteButton.addEventListener('click', () => deleteCourse(course.id));
      elements.modalActions.appendChild(deleteButton);
    } else if (course.status !== 'completed' && course.status !== 'issue_reported' && !isArchived) {
      const validateButton = document.createElement('button');
      validateButton.type = 'button';
      validateButton.className = 'px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition';
      validateButton.innerHTML = '<i class="fas fa-check mr-1"></i> Valider la course';
      validateButton.addEventListener('click', () => completeCourse(course.id));
      elements.modalActions.appendChild(validateButton);
    }

    showElement(elements.courseModal);
  } catch (error) {
    console.error('Erreur lors de la récupération de la course', error);
    alert(error.message);
  }
}

function completeCourse(courseId) {
  const cached = state.courseCache.get(courseId);
  if (cached?.isArchived) {
    return;
  }
  const commentsField = document.getElementById('completion-comments');
  state.pendingCompletionComments = commentsField ? commentsField.value : '';
  state.currentCourseId = courseId;
  openPhotoModal();
}

function stopCameraStream() {
  if (elements.camera?.srcObject) {
    elements.camera.srcObject.getTracks().forEach((track) => track.stop());
    elements.camera.srcObject = null;
  }
}

function stopStream(stream) {
  if (!stream) {
    return;
  }
  stream.getTracks().forEach((track) => track.stop());
}

function isRearCameraTrack(track) {
  if (!track) {
    return false;
  }
  const settings = track.getSettings ? track.getSettings() : {};
  const facingMode = settings.facingMode ? settings.facingMode.toLowerCase() : '';
  if (facingMode === 'environment' || facingMode === 'rear') {
    return true;
  }
  const label = (track.label || '').toLowerCase();
  return label.includes('back') || label.includes('rear') || label.includes('arrière') || label.includes('arriere') || label.includes('environment');
}

async function enumerateRearCameraDevice() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return null;
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoDevices = devices.filter((device) => device.kind === 'videoinput');
  if (!videoDevices.length) {
    return null;
  }
  const prioritized = videoDevices.find((device) => {
    const label = (device.label || '').toLowerCase();
    return label.includes('back') || label.includes('rear') || label.includes('arrière') || label.includes('arriere') || label.includes('environment');
  });
  return prioritized || videoDevices[0];
}

async function requestRearCameraStream() {
  const baseConstraints = [
    { video: { facingMode: { exact: 'environment' } } },
    { video: { facingMode: { ideal: 'environment' } } },
  ];
  let lastError = null;

  for (const constraints of baseConstraints) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const track = stream.getVideoTracks()[0];
      if (isRearCameraTrack(track)) {
        return stream;
      }

      const device = await enumerateRearCameraDevice();
      if (device) {
        stopStream(stream);
        const explicitStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: device.deviceId } },
        });
        return explicitStream;
      }

      return stream;
    } catch (error) {
      lastError = error;
    }
  }

  const fallbackDevice = await enumerateRearCameraDevice();
  if (fallbackDevice) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: fallbackDevice.deviceId } },
      });
      return stream;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Impossible d'accéder à la caméra arrière");
}

function updateCameraWarning(usingRearCamera) {
  const container = elements.photoPlaceholder?.parentElement;
  if (!container) {
    return;
  }

  const existing = container.querySelector('[data-camera-warning]');
  if (usingRearCamera) {
    existing?.remove();
    return;
  }

  const warning = existing || document.createElement('div');
  warning.dataset.cameraWarning = 'true';
  warning.className = existing
    ? warning.className
    : 'mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 animate-fade-up';
  warning.innerHTML =
    '<i class="fas fa-circle-info mr-1"></i>La caméra arrière n\'a pas pu être confirmée. Assurez-vous d\'utiliser l\'objectif principal de votre téléphone.';
  if (!existing) {
    container.appendChild(warning);
  }
}

function clearCameraWarning() {
  updateCameraWarning(true);
}

async function startCameraStream() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (elements.photoPlaceholder) {
      elements.photoPlaceholder.innerHTML = `
        <i class="fas fa-camera-slash text-4xl mb-2"></i>
        <p>Appareil photo non disponible sur cet appareil.</p>
      `;
      showElement(elements.photoPlaceholder);
    }
    return;
  }

  stopCameraStream();
  if (elements.photoPlaceholder) {
    elements.photoPlaceholder.innerHTML = `
      <i class="fas fa-camera text-4xl mb-2"></i>
      <p>Préparation de l'appareil photo...</p>
    `;
  }
  showElement(elements.photoPlaceholder);
  hideElement(elements.camera);

  try {
    const stream = await requestRearCameraStream();
    elements.camera.srcObject = stream;
    await elements.camera.play();
    const track = stream.getVideoTracks()[0];
    state.cameraFacingMode = 'environment';
    persistSessionState();
    hideElement(elements.photoPlaceholder);
    showElement(elements.camera);
    updateCameraWarning(isRearCameraTrack(track));
  } catch (error) {
    console.error('Impossible de démarrer la caméra arrière', error);
    clearCameraWarning();
    if (elements.photoPlaceholder) {
      elements.photoPlaceholder.innerHTML = `
        <i class="fas fa-camera-slash text-4xl mb-2"></i>
        <p>Impossible d'accéder à la caméra arrière.</p>
        <p class="text-sm mt-2 text-gray-500">Vérifiez les autorisations de votre navigateur ou l'état de la caméra.</p>
      `;
      showElement(elements.photoPlaceholder);
    }
  }
}

function setCameraFacingMode(mode, { persist = true, restart = true } = {}) {
  state.cameraFacingMode = 'environment';
  if (persist) {
    persistSessionState();
  }
  if (restart) {
    startCameraStream();
  }
}

function openPhotoModal() {
  state.photoDataUrl = null;
  showElement(elements.photoModal);
  hideElement(elements.camera);
  hideElement(elements.photoPreview);
  hideElement(elements.retakePhotoBtn);
  hideElement(elements.confirmPhotoBtn);
  showElement(elements.captureBtn);
  showElement(elements.photoPlaceholder);
  if (elements.photoPlaceholder) {
    elements.photoPlaceholder.innerHTML = `
      <i class="fas fa-camera text-4xl mb-2 text-green-600"></i>
      <p>Initialisation de la caméra…</p>
    `;
  }
  startCameraStream();
}

function closePhotoModal() {
  stopCameraStream();
  clearCameraWarning();

  hideElement(elements.photoModal);
  state.photoDataUrl = null;
}

function openCourseIssueModal(courseId) {
  if (state.currentUser?.role !== 'driver') {
    return;
  }

  const course = state.courseCache.get(courseId);
  if (!course || course.isArchived || course.status === 'completed' || course.status === 'issue_reported') {
    return;
  }

  state.courseIssue.courseId = courseId;
  state.courseIssue.submitting = false;
  elements.courseIssueComment.value = '';
  elements.courseIssueError.classList.add('hidden');
  showElement(elements.courseIssueModal);
}

function closeCourseIssueModal() {
  state.courseIssue.courseId = null;
  state.courseIssue.submitting = false;
  elements.courseIssueComment.value = '';
  elements.courseIssueError.classList.add('hidden');
  hideElement(elements.courseIssueModal);
}

async function handleCourseIssueSubmit(event) {
  event.preventDefault();

  if (!state.courseIssue.courseId) {
    return;
  }

  const comment = elements.courseIssueComment.value.trim();
  if (!comment) {
    elements.courseIssueError.textContent = 'Veuillez renseigner un commentaire.';
    elements.courseIssueError.classList.remove('hidden');
    return;
  }

  try {
    state.courseIssue.submitting = true;
    elements.courseIssueError.classList.add('hidden');
    const submitBtn = elements.courseIssueForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('opacity-75');
    }

    await apiFetch(`/courses/${state.courseIssue.courseId}/report-issue`, {
      method: 'POST',
      body: JSON.stringify({
        driverId: state.currentUser?.id,
        comment,
      }),
    });

    closeCourseIssueModal();
    await loadDriverCourses();
  } catch (error) {
    console.error('Erreur lors du signalement du problème', error);
    elements.courseIssueError.textContent = error.message || 'Impossible de signaler le problème.';
    elements.courseIssueError.classList.remove('hidden');
  } finally {
    state.courseIssue.submitting = false;
    const submitBtn = elements.courseIssueForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-75');
    }
  }
}

function resetMessagingState({ preserveAvailability = false } = {}) {
  state.messaging.unreadCount = 0;
  state.messaging.isOpen = false;
  state.messaging.loading = false;
  state.messaging.messages = [];
  state.messaging.threads = [];
  state.messaging.activeDriverId = null;
  state.messaging.sending = false;

  if (elements.messagingInput) {
    elements.messagingInput.value = '';
  }
  if (elements.messagingError) {
    elements.messagingError.textContent = '';
    elements.messagingError.classList.add('hidden');
  }
  if (elements.messagingMessages) {
    elements.messagingMessages.innerHTML = '';
  }
  if (elements.messagingThreadList) {
    elements.messagingThreadList.innerHTML = '';
  }
  if (elements.messagingUnread) {
    elements.messagingUnread.classList.add('hidden');
    elements.messagingUnread.textContent = '0';
  }

  hideElement(elements.messagingPanel);
  if (!preserveAvailability) {
    hideElement(elements.messagingFab);
  }
}

function updateMessagingSubtitle() {
  if (!elements.messagingSubtitle) {
    return;
  }

  if (!state.currentUser) {
    elements.messagingSubtitle.textContent = '';
    return;
  }

  if (state.currentUser.role === 'driver') {
    elements.messagingSubtitle.textContent = "Contactez l'administration en direct.";
  } else {
    elements.messagingSubtitle.textContent = 'Répondez instantanément aux messages des chauffeurs.';
  }
}

function updateMessagingBadge() {
  if (!elements.messagingUnread) {
    return;
  }

  if (state.messaging.unreadCount > 0) {
    elements.messagingUnread.textContent = String(state.messaging.unreadCount);
    elements.messagingUnread.classList.remove('hidden');
  } else {
    elements.messagingUnread.textContent = '0';
    elements.messagingUnread.classList.add('hidden');
  }
}

function updateMessagingAvailability() {
  if (!elements.messagingFab || !elements.messagingPanel) {
    return;
  }

  if (!state.currentUser) {
    resetMessagingState();
    return;
  }

  showElement(elements.messagingFab);
  updateMessagingSubtitle();
  refreshMessagingUnreadCount();
}

async function refreshMessagingUnreadCount() {
  if (!state.currentUser) {
    return;
  }

  try {
    if (state.currentUser.role === 'driver') {
      const data = await apiFetch(
        `/messages/unread-count?role=driver&driverId=${encodeURIComponent(state.currentUser.id)}`
      );
      state.messaging.unreadCount = data?.total || 0;
    } else {
      const data = await apiFetch('/messages/unread-count?role=admin');
      state.messaging.unreadCount = data?.total || 0;
      state.messaging.threads = Array.isArray(data?.perDriver) ? data.perDriver : [];
    }
  } catch (error) {
    console.warn('Impossible de récupérer le nombre de messages non lus', error);
    state.messaging.unreadCount = 0;
  }

  updateMessagingBadge();
}

function renderMessagingThreads() {
  if (!elements.messagingThreadList) {
    return;
  }

  elements.messagingThreadList.innerHTML = '';

  if (!state.messaging.threads.length) {
    const empty = document.createElement('p');
    empty.className = 'text-xs text-slate-500';
    empty.textContent = 'Aucune conversation pour le moment';
    elements.messagingThreadList.appendChild(empty);
    return;
  }

  state.messaging.threads
    .slice()
    .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0))
    .forEach((thread) => {
      const item = document.createElement('div');
      item.className = `messaging-thread${
        thread.driverId === state.messaging.activeDriverId ? ' messaging-thread--active' : ''
      }`;
      item.setAttribute('data-driver-id', thread.driverId);

      const name = document.createElement('div');
      name.className = 'messaging-thread__name';
      name.textContent = thread.driverName || `Chauffeur #${thread.driverId}`;
      item.appendChild(name);

      const meta = document.createElement('div');
      meta.className = 'messaging-thread__meta';

      const when = document.createElement('span');
      when.textContent = thread.lastMessageAt
        ? new Date(thread.lastMessageAt).toLocaleString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: 'short',
          })
        : '';
      meta.appendChild(when);

      if (thread.count || thread.unreadFromDriver) {
        const badge = document.createElement('span');
        badge.className = 'messaging-thread__badge';
        badge.textContent = String(thread.count || thread.unreadFromDriver || 0);
        meta.appendChild(badge);
      }

      item.appendChild(meta);
      elements.messagingThreadList.appendChild(item);
    });
}

function renderMessagingMessages() {
  if (!elements.messagingMessages) {
    return;
  }

  elements.messagingMessages.innerHTML = '';

  if (!state.messaging.messages.length) {
    const empty = document.createElement('p');
    empty.className = 'text-sm text-slate-500 text-center';
    empty.textContent = 'Envoyez un premier message pour démarrer la conversation.';
    elements.messagingMessages.appendChild(empty);
    return;
  }

  state.messaging.messages.forEach((message) => {
    const container = document.createElement('div');
    const isMine =
      (state.currentUser?.role === 'driver' && message.senderType === 'driver') ||
      (state.currentUser?.role === 'admin' && message.senderType === 'admin' &&
        (!message.senderId || message.senderId === state.currentUser.id));
    container.className = `messaging-message${isMine ? ' messaging-message--mine' : ''}`;

    const avatar = document.createElement('div');
    avatar.className = 'messaging-message__avatar';
    avatar.textContent = (message.senderInitials || '').slice(0, 3) || '??';
    container.appendChild(avatar);

    const bubble = document.createElement('div');
    bubble.className = 'messaging-message__bubble';

    const label = document.createElement('strong');
    label.textContent = message.senderLabel || (message.senderType === 'driver' ? 'Chauffeur' : 'Admin');
    bubble.appendChild(label);

    const body = document.createElement('p');
    body.textContent = message.body;
    bubble.appendChild(body);

    const meta = document.createElement('div');
    meta.className = 'messaging-message__meta';
    meta.textContent = new Date(message.createdAt).toLocaleString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short',
    });
    bubble.appendChild(meta);

    container.appendChild(bubble);
    elements.messagingMessages.appendChild(container);
  });

  elements.messagingMessages.scrollTop = elements.messagingMessages.scrollHeight;
}

async function markConversationAsRead(driverId, readerType) {
  try {
    await apiFetch(`/messages/${driverId}/read`, {
      method: 'POST',
      body: JSON.stringify({ readerType }),
    });
  } catch (error) {
    console.warn('Impossible de marquer la conversation comme lue', error);
  }
}

async function loadMessagingConversation(driverId, { markRead = true } = {}) {
  if (!driverId) {
    return;
  }

  state.messaging.loading = true;
  renderMessagingMessages();

  try {
    const role = state.currentUser?.role === 'admin' ? 'admin' : 'driver';
    const query = role === 'admin' ? 'role=admin' : `role=driver&driverId=${encodeURIComponent(driverId)}`;
    const data = await apiFetch(`/messages/threads/${driverId}?${query}`);
    const messages = Array.isArray(data?.messages) ? data.messages : [];
    state.messaging.messages = messages;
    renderMessagingMessages();

    if (markRead) {
      await markConversationAsRead(driverId, role);
      await refreshMessagingUnreadCount();
    }
  } catch (error) {
    console.error('Erreur lors du chargement de la conversation', error);
    elements.messagingError.textContent = error.message || 'Impossible de charger les messages.';
    elements.messagingError.classList.remove('hidden');
  } finally {
    state.messaging.loading = false;
  }
}

async function loadMessagingInbox() {
  try {
    const inbox = await apiFetch('/messages/inbox');
    state.messaging.threads = Array.isArray(inbox)
      ? inbox.map((thread) => ({
          driverId: thread.driverId,
          driverName: thread.driverName,
          lastMessageAt: thread.lastMessageAt,
          count: thread.unreadFromDriver || thread.count || 0,
        }))
      : [];
    renderMessagingThreads();
  } catch (error) {
    console.warn('Impossible de charger la liste des conversations', error);
    state.messaging.threads = [];
    renderMessagingThreads();
  }
}

function populateMessagingDriverPicker() {
  if (!elements.messagingDriverPicker) {
    return;
  }

  if (state.currentUser?.role !== 'admin') {
    elements.messagingDriverPicker.classList.add('hidden');
    return;
  }

  elements.messagingDriverPicker.classList.remove('hidden');
  elements.messagingDriverPicker.innerHTML = '<option value="">Choisir un chauffeur...</option>';

  (state.adminDrivers || []).forEach((driver) => {
    const option = document.createElement('option');
    option.value = driver.id;
    option.textContent = `${driver.firstName} ${driver.lastName}`;
    if (driver.id === state.messaging.activeDriverId) {
      option.selected = true;
    }
    elements.messagingDriverPicker.appendChild(option);
  });
}

async function ensureAdminDriversForMessaging() {
  if (state.currentUser?.role !== 'admin') {
    return;
  }

  if (!state.adminDrivers.length) {
    await loadAdminDrivers({ force: true });
  }
  populateMessagingDriverPicker();
}

async function openMessagingPanel() {
  if (!state.currentUser) {
    return;
  }

  state.messaging.isOpen = true;
  elements.messagingError.classList.add('hidden');
  elements.messagingMessages.innerHTML = '';
  showElement(elements.messagingPanel);

  if (state.currentUser.role === 'driver') {
    elements.messagingThreadList?.classList.add('hidden');
    elements.messagingDriverPicker?.classList.add('hidden');
    state.messaging.activeDriverId = state.currentUser.id;
    await loadMessagingConversation(state.messaging.activeDriverId);
  } else {
    elements.messagingThreadList?.classList.remove('hidden');
    await ensureAdminDriversForMessaging();
    await loadMessagingInbox();

    if (!state.messaging.activeDriverId) {
      if (state.messaging.threads.length) {
        state.messaging.activeDriverId = state.messaging.threads[0].driverId;
      } else if (state.adminDrivers.length) {
        state.messaging.activeDriverId = state.adminDrivers[0].id;
      }
    }

    populateMessagingDriverPicker();

    if (state.messaging.activeDriverId) {
      await loadMessagingConversation(state.messaging.activeDriverId);
      if (elements.messagingDriverPicker) {
        elements.messagingDriverPicker.value = String(state.messaging.activeDriverId);
      }
    } else {
      renderMessagingMessages();
    }
  }

  state.messaging.unreadCount = 0;
  updateMessagingBadge();
}

function closeMessagingPanel() {
  state.messaging.isOpen = false;
  hideElement(elements.messagingPanel);
}

function toggleMessagingPanel() {
  if (state.messaging.isOpen) {
    closeMessagingPanel();
  } else {
    openMessagingPanel();
  }
}

function selectMessagingThread(driverId) {
  if (!driverId || state.messaging.activeDriverId === driverId) {
    return;
  }
  state.messaging.activeDriverId = driverId;
  renderMessagingThreads();
  loadMessagingConversation(driverId);
  if (elements.messagingDriverPicker) {
    elements.messagingDriverPicker.value = String(driverId);
  }
}

async function handleMessagingSubmit(event) {
  event.preventDefault();

  if (!state.currentUser) {
    return;
  }

  const body = elements.messagingInput.value.trim();
  if (!body) {
    elements.messagingError.textContent = 'Le message ne peut pas être vide.';
    elements.messagingError.classList.remove('hidden');
    return;
  }

  if (!state.messaging.activeDriverId) {
    elements.messagingError.textContent = "Sélectionnez un chauffeur avant d'envoyer un message.";
    elements.messagingError.classList.remove('hidden');
    return;
  }

  try {
    elements.messagingError.classList.add('hidden');
    state.messaging.sending = true;
    const payload = {
      driverId: state.messaging.activeDriverId,
      body,
      senderType: state.currentUser.role === 'admin' ? 'admin' : 'driver',
    };
    const message = await apiFetch('/messages', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    elements.messagingInput.value = '';
    if (Array.isArray(state.messaging.messages)) {
      state.messaging.messages.push(message);
    } else {
      state.messaging.messages = [message];
    }
    renderMessagingMessages();
    await refreshMessagingUnreadCount();
  } catch (error) {
    console.error("Erreur lors de l'envoi du message", error);
    elements.messagingError.textContent = error.message || "Impossible d'envoyer le message.";
    elements.messagingError.classList.remove('hidden');
  } finally {
    state.messaging.sending = false;
  }
}

function handleMessagingDriverChange(event) {
  const value = Number.parseInt(event.target.value, 10);
  if (Number.isInteger(value)) {
    selectMessagingThread(value);
  }
}

function handleMessagingThreadClick(event) {
  const target = event.target.closest('[data-driver-id]');
  if (!target) {
    return;
  }
  const driverId = Number.parseInt(target.getAttribute('data-driver-id'), 10);
  if (Number.isInteger(driverId)) {
    selectMessagingThread(driverId);
  }
}

function processRealtimeMessage(payload) {
  if (!payload || !payload.message || !payload.driverId || !state.currentUser) {
    return;
  }

  const driverId = Number(payload.driverId);
  const message = payload.message;
  const senderType = payload.senderType;

  const isDriver = state.currentUser.role === 'driver' && driverId === state.currentUser.id;
  const isAdmin = state.currentUser.role === 'admin';

  if (!isDriver && !isAdmin) {
    return;
  }

  if (isDriver && senderType === 'driver') {
    return;
  }

  if (isAdmin && senderType === 'admin' && message.senderId && message.senderId === state.currentUser.id) {
    return;
  }

  const isCurrentConversation = state.messaging.isOpen && state.messaging.activeDriverId === driverId;
  const alreadyPresent = state.messaging.messages.some((existing) => existing.id === message.id);

  if (isCurrentConversation && !alreadyPresent) {
    state.messaging.messages.push(message);
    renderMessagingMessages();

    if (isDriver && senderType === 'admin') {
      markConversationAsRead(driverId, 'driver');
      refreshMessagingUnreadCount();
    }

    if (isAdmin && senderType === 'driver') {
      markConversationAsRead(driverId, 'admin');
      refreshMessagingUnreadCount();
    }
  } else if (!alreadyPresent) {
    refreshMessagingUnreadCount();
  }

  if (isAdmin) {
    const existing = state.messaging.threads.find((thread) => thread.driverId === driverId);
    if (existing) {
      existing.lastMessageAt = message.createdAt;
      if (senderType === 'driver') {
        existing.count = (existing.count || 0) + 1;
      }
    } else {
      state.messaging.threads.push({
        driverId,
        driverName: message.senderLabel || `Chauffeur #${driverId}`,
        lastMessageAt: message.createdAt,
        count: senderType === 'driver' ? 1 : 0,
      });
    }
    renderMessagingThreads();
  }
}

function processMessageReadEvent(payload) {
  if (!payload || !state.currentUser) {
    return;
  }

  if (state.currentUser.role === 'driver') {
    if (Number(payload.driverId) === state.currentUser.id && payload.readerType === 'driver') {
      refreshMessagingUnreadCount();
    }
  } else if (state.currentUser.role === 'admin' && payload.readerType === 'admin') {
    refreshMessagingUnreadCount();
    if (state.messaging.threads.length) {
      state.messaging.threads = state.messaging.threads.map((thread) =>
        thread.driverId === Number(payload.driverId) ? { ...thread, count: 0 } : thread
      );
      renderMessagingThreads();
    }
  }
}

function capturePhoto() {
  const context = elements.canvas.getContext('2d');
  elements.canvas.width = elements.camera.videoWidth;
  elements.canvas.height = elements.camera.videoHeight;
  context.drawImage(elements.camera, 0, 0, elements.canvas.width, elements.canvas.height);

  state.photoDataUrl = elements.canvas.toDataURL('image/jpeg');
  elements.previewImg.src = state.photoDataUrl;

  hideElement(elements.camera);
  hideElement(elements.captureBtn);
  showElement(elements.photoPreview);
  showElement(elements.retakePhotoBtn);
  showElement(elements.confirmPhotoBtn);
  stopCameraStream();
}

function retakePhoto() {
  state.photoDataUrl = null;
  hideElement(elements.photoPreview);
  hideElement(elements.retakePhotoBtn);
  hideElement(elements.confirmPhotoBtn);
  showElement(elements.captureBtn);
  showElement(elements.photoPlaceholder);
  if (elements.photoPlaceholder) {
    elements.photoPlaceholder.innerHTML = `
      <i class="fas fa-camera text-4xl mb-2 text-green-600"></i>
      <p>Initialisation de la caméra…</p>
    `;
  }
  startCameraStream();
}

async function confirmPhoto() {
  if (!state.currentCourseId) {
    return;
  }

  try {
    await apiFetch(`/courses/${state.currentCourseId}/complete`, {
      method: 'POST',
      body: JSON.stringify({
        completionComments: state.pendingCompletionComments,
        photoDataUrl: state.photoDataUrl,
        userInitials: getUserInitials(),
      }),
    });

    await loadDriverCourses();
    if (state.isAdmin) {
      await loadAdminCourses();
    }
    await loadActivityLog();

    closePhotoModal();
    hideElement(elements.courseModal);
    alert('Course validée et email envoyé.');
  } catch (error) {
    console.error('Erreur lors de la validation de la course', error);
    alert(error.message);
  }
}

function clearPersistedSession() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.removeItem('agriHolannSession');
  } catch (error) {
    console.warn('Impossible de supprimer la session enregistrée', error);
  }
}

function persistSessionState() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  if (!state.currentUser) {
    clearPersistedSession();
    return;
  }

  const session = {
    role: state.currentUser.role,
    activeDriverTab: state.activeDriverTab || 'today',
    cameraFacingMode: state.cameraFacingMode,
    displayPreferences: { ...state.displayPreferences },
    driverPreferencesTab: state.driverPreferences?.activeTab || 'today',
  };

  if (state.currentUser.role === 'driver') {
    session.user = {
      id: state.currentUser.id,
      firstName: state.currentUser.firstName,
      lastName: state.currentUser.lastName,
      hasPassword: state.currentUser.hasPassword || false,
    };
    session.token = state.currentUser.token || null;
  } else if (state.currentUser.role === 'admin') {
    session.user = {
      id: state.currentUser.id,
      firstName: state.currentUser.firstName,
      lastName: state.currentUser.lastName,
      identifier: state.currentUser.identifier,
      initials: state.currentUser.initials,
      adminLevel: state.currentUser.adminLevel,
    };
    session.token = state.currentUser.token || null;
    session.adminView = state.adminView;
    session.adminOptionsPane = state.adminOptionsPane || 'core';
    session.settingsTab = state.settings?.activeTab || 'email';
    session.adminManagementView = state.adminManagementView || 'list';
    session.adminFilters = { ...state.adminFilters };
    session.archiveFilters = { ...state.archiveFilters };
  }

  try {
    window.localStorage.setItem('agriHolannSession', JSON.stringify(session));
  } catch (error) {
    console.warn('Impossible de sauvegarder la session', error);
  }
}

function handleRealtimeEvent(event) {
  if (!event || !event.type) {
    return;
  }

  const payload = event.payload || {};

  switch (event.type) {
    case 'drivers:updated':
      if (state.isAdmin) {
        loadAdminDrivers({ force: true });
        loadDriverCredentials();
      }
      if (state.currentUser?.role === 'driver') {
        if (!payload.driverId || payload.driverId === state.currentUser.id) {
          loadDriverCourses();
        }
      }
      break;
    case 'driver-passwords:updated':
      if (state.isAdmin) {
        loadDriverCredentials();
      }
      if (state.currentUser?.role === 'driver') {
        if (!payload.driverId || payload.driverId === state.currentUser.id) {
          loadDriverCourses();
        }
      }
      break;
    case 'courses:changed':
      if (state.currentUser?.role === 'driver') {
        if (!payload.driverId || payload.driverId === state.currentUser.id) {
          loadDriverCourses();
        }
      }
      if (state.isAdmin) {
        loadAdminCourses();
        loadArchivedCourses();
        loadActivityLog();
      }
      break;
    case 'activity:changed':
      if (state.isAdmin) {
        loadActivityLog();
      }
      break;
    case 'admins:updated':
      if (state.isAdmin && state.currentUser?.adminLevel === 'superadmin') {
        loadAdmins();
      }
      break;
    case 'settings:email-updated':
      if (state.isAdmin) {
        loadEmailRecipient();
      }
      break;
    case 'messages:new':
      processRealtimeMessage(payload);
      break;
    case 'messages:read':
      processMessageReadEvent(payload);
      break;
    case 'sessions:driver:revoked':
      handleDriverSessionRevoked(payload);
      break;
    case 'sessions:admin:revoked':
      handleAdminSessionRevoked(payload);
      break;
    default:
      break;
  }

  maybeShowRealtimeNotification(event);
}

function handleDriverSessionRevoked(payload) {
  if (state.currentUser?.role !== 'driver') {
    return;
  }

  const revokedToken = payload?.token || null;
  const targetDriverId = Number(payload?.driverId);
  const hasMatchingToken = Boolean(revokedToken && state.currentUser.token && state.currentUser.token === revokedToken);
  const matchesById =
    !revokedToken && !state.currentUser.token && Number.isInteger(targetDriverId) && targetDriverId === state.currentUser.id;

  if (hasMatchingToken || matchesById) {
    resetAppToLogin({
      message: 'Votre session chauffeur a été ouverte sur un autre appareil. Veuillez vous reconnecter.',
    });
  }
}

function handleAdminSessionRevoked(payload) {
  if (state.currentUser?.role !== 'admin') {
    return;
  }

  const revokedToken = payload?.token || null;
  const targetAdminId = Number(payload?.adminId);
  const hasMatchingToken = Boolean(revokedToken && state.currentUser.token && state.currentUser.token === revokedToken);
  const matchesById =
    !revokedToken && !state.currentUser.token && Number.isInteger(targetAdminId) && targetAdminId === state.currentUser.id;

  if (hasMatchingToken || matchesById) {
    resetAppToLogin({
      message: 'Votre session administrateur a été ouverte sur un autre appareil. Veuillez vous reconnecter.',
    });
  }
}

function setupRealtimeUpdates() {
  if (typeof window === 'undefined' || !window.EventSource) {
    console.warn("Les mises à jour en direct ne sont pas supportées par ce navigateur.");
    return;
  }

  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource(`${API_BASE}/events`);

  eventSource.onmessage = (message) => {
    if (!message?.data) {
      return;
    }
    try {
      const event = JSON.parse(message.data);
      handleRealtimeEvent(event);
    } catch (error) {
      console.warn('Impossible de décoder un événement en temps réel', error);
    }
  };

  eventSource.onerror = (error) => {
    console.warn('Connexion temps réel interrompue, nouvelle tentative automatique...', error);
  };
}

async function restoreSessionFromStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    showElement(elements.loginPage);
    return;
  }

  const raw = window.localStorage.getItem('agriHolannSession');
  if (!raw) {
    showElement(elements.loginPage);
    return;
  }

  let saved;
  try {
    saved = JSON.parse(raw);
  } catch (error) {
    console.warn('Session locale invalide, purge.', error);
    clearPersistedSession();
    showElement(elements.loginPage);
    return;
  }

  if (saved.displayPreferences) {
    state.displayPreferences = {
      ...state.displayPreferences,
      ...saved.displayPreferences,
    };
  }

  if (saved.cameraFacingMode) {
    state.cameraFacingMode = saved.cameraFacingMode;
  }

  if (saved.role === 'admin' && saved.token) {
    try {
      const response = await fetch(`${API_BASE}/admins/session`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': saved.token,
        },
      });

      if (!response.ok) {
        throw new Error('Session administrateur invalide');
      }

      const admin = await response.json();
      setAdminSession(admin, {
        view: saved.adminView || 'planning',
        driverTab: saved.activeDriverTab || 'week',
        settingsTab: saved.settingsTab || 'email',
        adminManagementView: saved.adminManagementView || 'list',
        adminFilters: saved.adminFilters || {},
        archiveFilters: saved.archiveFilters || {},
        displayPreferences: saved.displayPreferences || {},
        driverPreferencesTab: saved.driverPreferencesTab || 'today',
        adminOptionsPane: saved.adminOptionsPane || 'core',
      });
      return;
    } catch (error) {
      console.warn('Impossible de restaurer la session administrateur', error);
      clearPersistedSession();
      showElement(elements.loginPage);
      return;
    }
  }

  if (saved.role === 'driver' && saved.user?.id && saved.token) {
    try {
      const response = await fetch(`${API_BASE}/drivers/session`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Driver-Token': saved.token,
        },
      });

      if (!response.ok) {
        throw new Error('Session chauffeur invalide');
      }

      const driver = await response.json();

      await activateDriverSession(driver, {
        token: saved.token,
        initialTab: saved.activeDriverTab || 'today',
        displayPreferences: saved.displayPreferences || {},
        preferencesTab: saved.driverPreferencesTab || 'today',
      });
      return;
    } catch (error) {
      console.warn('Impossible de restaurer la session chauffeur', error);
      clearPersistedSession();
      showElement(elements.loginPage);
      return;
    }
  }

  clearPersistedSession();
  showElement(elements.loginPage);
}

function registerEventListeners() {
  elements.lastnameInput.addEventListener('input', searchDrivers);
  elements.adminLoginBtn.addEventListener('click', openAdminLoginModal);
  elements.logoutBtn.addEventListener('click', logout);
  elements.adminLogoutBtn.addEventListener('click', logout);
  elements.todayTab.addEventListener('click', () => switchTab('today'));
  elements.weekTab.addEventListener('click', () => switchTab('week'));
  elements.newCourseTab.addEventListener('click', () => {
    state.currentCourseId = null;
    elements.addCourseForm.reset();
    setDefaultCourseDateTime();
    if (state.isAdmin) {
      const selected = elements.adminDriverSelect.value;
      elements.adminDriverPicker.value = selected !== 'all' ? selected : '';
    }
    switchTab('new-course');
  });
  elements.addCourseForm.addEventListener('submit', handleAddCourse);
  elements.cancelCourseBtn.addEventListener('click', () => {
    state.currentCourseId = null;
    elements.addCourseForm.reset();
    setDefaultCourseDateTime();
    switchTab(state.isAdmin ? 'week' : 'today');
  });
  elements.closeModalBtn.addEventListener('click', () => hideElement(elements.courseModal));
  elements.closePhotoModalBtn.addEventListener('click', closePhotoModal);
  elements.captureBtn.addEventListener('click', capturePhoto);
  elements.confirmPhotoBtn.addEventListener('click', confirmPhoto);
  elements.retakePhotoBtn.addEventListener('click', retakePhoto);
  elements.switchCameraBtn?.addEventListener('click', () => {
    const nextMode = state.cameraFacingMode === 'environment' ? 'user' : 'environment';
    setCameraFacingMode(nextMode);
  });
  elements.cameraFacingSelect?.addEventListener('change', (event) => {
    setCameraFacingMode(event.target.value || 'environment');
  });
  elements.courseIssueForm?.addEventListener('submit', handleCourseIssueSubmit);
  elements.courseIssueCancel?.addEventListener('click', closeCourseIssueModal);
  elements.courseIssueClose?.addEventListener('click', closeCourseIssueModal);
  elements.messagingToggle?.addEventListener('click', toggleMessagingPanel);
  elements.messagingClose?.addEventListener('click', closeMessagingPanel);
  elements.messagingForm?.addEventListener('submit', handleMessagingSubmit);
  elements.messagingDriverPicker?.addEventListener('change', handleMessagingDriverChange);
  elements.messagingThreadList?.addEventListener('click', handleMessagingThreadClick);
  if (elements.adminPaneButtons?.length) {
    elements.adminPaneButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const paneKey = button.getAttribute('data-admin-pane') || 'core';
        setAdminOptionsPane(paneKey);
        persistSessionState();
      });
    });
  }
  elements.adminDriverSelect.addEventListener('change', () => {
    state.adminFilters.driverId = elements.adminDriverSelect.value || 'all';
    loadAdminCourses();
    persistSessionState();
  });
  elements.newCourseAdminBtn.addEventListener('click', () => {
    openCourseEditor();
  });
  elements.courseEditorForm.addEventListener('submit', handleCourseEditorSubmit);
  elements.cancelCourseEditorBtn.addEventListener('click', closeCourseEditor);
  elements.closeCourseEditorBtn.addEventListener('click', closeCourseEditor);

  if (elements.adminRangeButtons) {
    elements.adminRangeButtons.forEach((button) => {
      button.addEventListener('click', handleAdminRangeClick);
    });
  }

  elements.adminStatusFilter?.addEventListener('change', handleAdminStatusChange);
  elements.adminMerchandiseFilter?.addEventListener('change', handleAdminMerchandiseChange);
  elements.adminIssueFilter?.addEventListener('change', handleAdminIssueChange);
  elements.adminPhotoFilter?.addEventListener('change', handleAdminPhotoChange);
  elements.adminFromInput?.addEventListener('change', handleAdminDateChange);
  elements.adminToInput?.addEventListener('change', handleAdminDateChange);
  elements.adminSearchFilter?.addEventListener('input', handleAdminSearchInput);
  elements.adminResetFiltersBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    resetAdminFilters();
  });
  elements.adminExportPdfBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    exportCourses('pdf', state.adminView === 'archives' ? 'archives' : 'planning');
  });
  elements.adminExportExcelBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    exportCourses('xlsx', state.adminView === 'archives' ? 'archives' : 'planning');
  });
  elements.archiveExportPdfBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    exportCourses('pdf', 'archives');
  });
  elements.archiveExportExcelBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    exportCourses('xlsx', 'archives');
  });

  elements.driverLayoutButtons?.forEach((button) => {
    button.addEventListener('click', handleDriverLayoutChange);
  });
  elements.driverDensityButtons?.forEach((button) => {
    button.addEventListener('click', handleDriverDensityChange);
  });
  elements.driverWeekLayoutButtons?.forEach((button) => {
    button.addEventListener('click', handleDriverWeekLayoutChange);
  });
  elements.driverPreferencesToggle?.addEventListener('click', toggleDriverPreferences);
  elements.driverPreferencesClose?.addEventListener('click', closeDriverPreferences);
  if (elements.driverPreferencesTabs?.length) {
    elements.driverPreferencesTabs.forEach((button) => {
      button.addEventListener('click', () => {
        const tabKey = button.getAttribute('data-driver-preferences-tab') || 'today';
        setDriverPreferencesTab(tabKey);
        persistSessionState();
      });
    });
  }
  elements.adminLayoutButtons?.forEach((button) => {
    button.addEventListener('click', handleAdminLayoutChange);
  });
  elements.adminDensityButtons?.forEach((button) => {
    button.addEventListener('click', handleAdminDensityChange);
  });
  elements.notificationAllow?.addEventListener('click', (event) => {
    event.preventDefault();
    requestNotificationPermission();
  });
  elements.notificationDismiss?.addEventListener('click', (event) => {
    event.preventDefault();
    handleNotificationDismiss();
  });

  elements.adminPlanningTab?.addEventListener('click', () => switchAdminView('planning'));
  elements.adminArchivesTab?.addEventListener('click', () => switchAdminView('archives'));
  elements.adminSettingsTab?.addEventListener('click', () => switchAdminView('settings'));

  elements.closeAdminLoginModalBtn?.addEventListener('click', closeAdminLoginModal);
  elements.adminLoginForm?.addEventListener('submit', handleAdminLogin);
  elements.driverManagementForm?.addEventListener('submit', handleAddDriver);
  elements.driverManagementToggle?.addEventListener('click', () => {
    state.driverManagement.expanded = !state.driverManagement.expanded;
    renderDriverManagementPanel();
    if (state.driverManagement.expanded && !state.adminDrivers.length && !state.driverManagement.loading) {
      loadAdminDrivers({ force: true });
    }
  });

  elements.archivePeriodFilter?.addEventListener('change', handleArchivePeriodChange);
  elements.archiveDriverFilter?.addEventListener('change', handleArchiveFiltersChange);
  elements.archiveMerchandiseFilter?.addEventListener('change', handleArchiveFiltersChange);
  elements.archiveFromInput?.addEventListener('change', handleArchiveDatesChange);
  elements.archiveToInput?.addEventListener('change', handleArchiveDatesChange);
  elements.emailSettingsForm?.addEventListener('submit', handleEmailSettingsSubmit);
  elements.driverPasswordForm?.addEventListener('submit', handleDriverPasswordSubmit);
  elements.driverPasswordCancel?.addEventListener('click', () => {
    closeDriverPasswordModal();
  });
  if (elements.settingsTabButtons) {
    elements.settingsTabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const tabKey = button.getAttribute('data-settings-tab');
        setSettingsTab(tabKey || 'email');
      });
    });
  }
  if (elements.adminManagementTabButtons && elements.adminManagementTabButtons.length) {
    elements.adminManagementTabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const tabKey = button.getAttribute('data-admin-management-tab') || 'list';
        setAdminManagementView(tabKey);
      });
    });
  }
  elements.adminManagementCreateForm?.addEventListener('submit', handleAdminCreation);
  elements.adminPasswordForm?.addEventListener('submit', handleAdminPasswordChange);

  window.addEventListener('click', (event) => {
    if (event.target === elements.courseModal) {
      hideElement(elements.courseModal);
    }
    if (event.target === elements.photoModal) {
      closePhotoModal();
    }
    if (event.target === elements.courseEditorModal) {
      closeCourseEditor();
    }
    if (event.target === elements.adminLoginModal) {
      closeAdminLoginModal();
    }
    if (event.target === elements.driverPasswordModal) {
      closeDriverPasswordModal();
    }
    if (event.target === elements.courseIssueModal) {
      closeCourseIssueModal();
    }
    if (event.target === elements.messagingPanel) {
      closeMessagingPanel();
    }
    if (event.target === elements.notificationPrompt) {
      handleNotificationDismiss();
    }
  });
}

function init() {
  setDefaultCourseDateTime();
  updateAdminRangeButtons();
  updateArchivePeriodInputs();
  renderDriverManagementPanel();
  renderAdminOptionsPane();
  renderSettingsTabs();
  applyDisplayPreferences();
  setDriverPreferencesTab(state.driverPreferences.activeTab);
  syncDriverPreferencesPanel();
  lockMobileViewport();
  registerEventListeners();
  setupRealtimeUpdates();
  resetMessagingState();
  restoreSessionFromStorage();

  if (typeof window !== 'undefined') {
    document.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('resize', handleViewportResize);
    window.addEventListener('orientationchange', lockMobileViewport);
  }
}

document.addEventListener('DOMContentLoaded', init);

window.addEventListener('beforeunload', () => {
  if (eventSource) {
    eventSource.close();
  }
});

const API_BASE = '/api';

const state = {
  drivers: [],
  driverCourses: [],
  adminCourses: [],
  archivedCourses: [],
  activityLog: [],
  courseCache: new Map(),
  currentUser: null,
  isAdmin: false,
  admins: [],
  adminFilters: {
    driverId: 'all',
    range: 'week',
  },
  archiveFilters: {
    driverId: 'all',
    merchandise: 'all',
    period: 'week',
    from: null,
    to: null,
  },
  adminView: 'planning',
  currentCourseId: null,
  photoDataUrl: null,
  pendingCompletionComments: '',
  settings: {
    emailRecipient: '',
    loaded: false,
    saving: false,
  },
};

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
  adminDriverSelect: document.getElementById('admin-driver-select'),
  adminWeekList: document.getElementById('admin-week-list'),
  noCoursesAdmin: document.getElementById('no-courses-admin'),
  activityLogList: document.getElementById('activity-log'),
  noActivity: document.getElementById('no-activity'),
  newCourseAdminBtn: document.getElementById('new-course-admin'),
  adminRangeButtons: document.querySelectorAll('[data-admin-range]'),
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
  adminCreateForm: document.getElementById('admin-create-form'),
  adminCreateFirstName: document.getElementById('admin-create-first-name'),
  adminCreateLastName: document.getElementById('admin-create-last-name'),
  adminCreatePassword: document.getElementById('admin-create-password'),
  adminIdentifierPreview: document.getElementById('admin-identifier-preview'),
  adminIdentifierPreviewValue: document.getElementById('admin-identifier-preview-value'),
  driverManagementForm: document.getElementById('driver-management-form'),
  driverFirstNameInput: document.getElementById('driver-first-name'),
  driverLastNameInput: document.getElementById('driver-last-name'),
  driverEmailInput: document.getElementById('driver-email'),
  driverListContainer: document.getElementById('driver-management-list'),
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
  emailSettingsStatus: document.getElementById('email-settings-status'),
};

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
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  };

  const response = await fetch(`${API_BASE}${path}`, config);
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || 'Une erreur est survenue');
  }

  if (response.status === 204) {
    return null;
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
  };
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
    state.drivers = drivers.map(normalizeDriver);
    renderDriverList(state.drivers);
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
      <div class="text-xs text-gray-500">Chauffeur</div>
    `;
    button.addEventListener('click', () => loginAsDriver(driver));
    elements.driverList.appendChild(button);
  });

  showElement(elements.driverResults);
}

async function loginAsDriver(driver) {
  state.currentUser = {
    ...driver,
    role: 'driver',
    initials: computeInitials(driver.firstName, driver.lastName),
  };
  state.isAdmin = false;
  elements.driverNameDisplay.textContent = `${driver.firstName} ${driver.lastName}`;
  hideElement(elements.loginPage);
  showElement(elements.driverDashboard);
  hideElement(elements.adminDashboard);
  switchTab('today');
  await loadDriverCourses();
}

function setAdminSession(admin) {
  const normalized = normalizeAdmin(admin);
  state.currentUser = {
    ...normalized,
    role: 'admin',
  };
  state.isAdmin = true;
  state.adminFilters = { driverId: 'all', range: 'week' };
  state.archiveFilters = { driverId: 'all', merchandise: 'all', period: 'week', from: null, to: null };
  state.settings = { emailRecipient: '', loaded: false, saving: false };
  updateArchivePeriodInputs();

  hideElement(elements.loginPage);
  hideElement(elements.driverDashboard);
  showElement(elements.adminDashboard);
  closeAdminLoginModal();

  if (elements.adminIdentifierDisplay) {
    elements.adminIdentifierDisplay.textContent = `${state.currentUser.initials} (${state.currentUser.identifier})`;
  }

  if (elements.emailRecipientInput) {
    elements.emailRecipientInput.value = '';
  }
  resetEmailSettingsStatus();

  state.adminView = 'planning';
  switchAdminView('planning');
  updateAdminRangeButtons();
  switchTab('week');

  loadAdminDrivers();
  loadAdminCourses();
  loadActivityLog();
  loadArchivedCourses();
}

function openAdminLoginModal() {
  if (!elements.adminLoginModal) {
    return;
  }
  elements.adminIdentifierInput.value = '';
  if (elements.adminPasswordInput) {
    elements.adminPasswordInput.value = '';
  }
  elements.adminCreateForm?.reset();
  if (elements.adminCreatePassword) {
    elements.adminCreatePassword.value = '';
  }
  updateAdminIdentifierPreview();
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

async function handleAdminCreate(event) {
  event.preventDefault();

  const firstName = elements.adminCreateFirstName.value.trim();
  const lastName = elements.adminCreateLastName.value.trim();
  const password = elements.adminCreatePassword?.value || '';

  if (!firstName || !lastName) {
    alert('Veuillez renseigner un prénom et un nom.');
    return;
  }

  if (!password) {
    alert('Veuillez définir un mot de passe pour ce compte administrateur.');
    return;
  }

  try {
    const admin = await apiFetch('/admins', {
      method: 'POST',
      body: JSON.stringify({ firstName, lastName, password }),
    });

    await loadAdmins();
    alert(`Compte administrateur créé. Identifiant : ${admin.identifier}`);
    setAdminSession(admin);
  } catch (error) {
    console.error('Erreur lors de la création du compte administrateur', error);
    alert(error.message);
  }
}

async function loadAdmins() {
  try {
    const admins = await apiFetch('/admins');
    state.admins = admins.map(normalizeAdmin);
    renderAdminAccounts();
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
        <div class="text-xs text-gray-500">Identifiant : <span class="font-mono">${admin.identifier}</span></div>
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

function updateAdminIdentifierPreview() {
  if (!elements.adminIdentifierPreview) {
    return;
  }

  const firstName = elements.adminCreateFirstName.value;
  const lastName = elements.adminCreateLastName.value;
  const identifier = computeAdminIdentifier(firstName, lastName);

  if (identifier) {
    elements.adminIdentifierPreviewValue.textContent = identifier;
    showElement(elements.adminIdentifierPreview);
  } else {
    elements.adminIdentifierPreviewValue.textContent = '';
    hideElement(elements.adminIdentifierPreview);
  }
}

function logout() {
  state.currentUser = null;
  state.isAdmin = false;
  state.driverCourses = [];
  state.adminCourses = [];
  state.archivedCourses = [];
  state.adminFilters = { driverId: 'all', range: 'week' };
  state.archiveFilters = { driverId: 'all', merchandise: 'all', period: 'week', from: null, to: null };
  state.settings = { emailRecipient: '', loaded: false, saving: false };
  state.activityLog = [];
  state.courseCache.clear();
  elements.lastnameInput.value = '';
  elements.driverList.innerHTML = '';
  hideElement(elements.driverDashboard);
  hideElement(elements.adminDashboard);
  hideElement(elements.courseModal);
  closePhotoModal();
  closeCourseEditor();
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
  state.adminView = 'planning';
  updateAdminRangeButtons();
  updateArchivePeriodInputs();
  showElement(elements.loginPage);
  switchTab('today');
}

function switchTab(tab) {
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
    loadEmailSettings();
  }
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

async function loadAdminDrivers() {
  try {
    const drivers = await apiFetch('/drivers');
    state.drivers = drivers.map(normalizeDriver);
    const selectedDriverFilter = state.adminFilters.driverId || 'all';

    elements.adminDriverSelect.innerHTML = '<option value="all">Tous les chauffeurs</option>';
    elements.adminDriverPicker.innerHTML = '<option value="">Sélectionnez un chauffeur</option>';
    elements.courseEditorDriver.innerHTML = '<option value="">Sélectionnez un chauffeur</option>';
    if (elements.archiveDriverFilter) {
      elements.archiveDriverFilter.innerHTML = '<option value="all">Tous les chauffeurs</option>';
    }

    state.drivers.forEach((driver) => {
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

    renderDriverManagement();
  } catch (error) {
    console.error('Erreur lors du chargement des chauffeurs', error);
  }
}

function renderDriverManagement() {
  if (!elements.driverListContainer) {
    return;
  }

  elements.driverListContainer.innerHTML = '';

  if (!state.drivers.length) {
    const empty = document.createElement('p');
    empty.className = 'text-sm text-gray-500';
    empty.textContent = 'Aucun chauffeur enregistré.';
    elements.driverListContainer.appendChild(empty);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'divide-y divide-gray-200';

  state.drivers.forEach((driver) => {
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
    await loadAdminDrivers();
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
    await loadAdminDrivers();
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

async function loadAdminCourses() {
  const params = new URLSearchParams();
  const today = startOfDay(new Date());
  let from = null;
  let to = null;

  switch (state.adminFilters.range) {
    case 'day':
      from = today;
      to = addDays(today, 1);
      break;
    case 'week':
      from = addDays(today, -7);
      to = addDays(today, 7);
      break;
    case 'all':
    default:
      break;
  }

  if (from) {
    params.append('from', from.toISOString());
  }
  if (to) {
    params.append('to', to.toISOString());
  }

  if (state.adminFilters.driverId && state.adminFilters.driverId !== 'all') {
    params.append('driverId', state.adminFilters.driverId);
  }

  try {
    const courses = await apiFetch(`/courses?${params.toString()}`);
    state.adminCourses = courses.map(mapCourse);
    renderAdminCourses();
  } catch (error) {
    console.error('Erreur lors du chargement des courses', error);
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

function updateArchivePeriodInputs() {
  if (!elements.archiveFromInput || !elements.archiveToInput) {
    return;
  }

  const isCustom = state.archiveFilters.period === 'custom';
  elements.archiveFromInput.disabled = !isCustom;
  elements.archiveToInput.disabled = !isCustom;

  if (!isCustom) {
    elements.archiveFromInput.value = '';
    elements.archiveToInput.value = '';
    state.archiveFilters.from = null;
    state.archiveFilters.to = null;
  }
}

function handleArchivePeriodChange() {
  if (!elements.archivePeriodFilter) {
    return;
  }
  state.archiveFilters.period = elements.archivePeriodFilter.value || 'week';
  updateArchivePeriodInputs();
  loadArchivedCourses();
}

function handleArchiveFiltersChange() {
  if (elements.archiveDriverFilter) {
    state.archiveFilters.driverId = elements.archiveDriverFilter.value || 'all';
  }
  if (elements.archiveMerchandiseFilter) {
    state.archiveFilters.merchandise = elements.archiveMerchandiseFilter.value || 'all';
  }
  loadArchivedCourses();
}

function handleArchiveDatesChange() {
  if (!elements.archiveFromInput || !elements.archiveToInput) {
    return;
  }
  state.archiveFilters.from = elements.archiveFromInput.value || null;
  state.archiveFilters.to = elements.archiveToInput.value || null;
  loadArchivedCourses();
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

async function loadEmailSettings(force = false) {
  if (!elements.emailRecipientInput) {
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

  if (!elements.emailRecipientInput) {
    return;
  }

  if (state.settings.saving) {
    return;
  }

  const email = elements.emailRecipientInput.value.trim();

  if (!email) {
    showEmailSettingsStatus('Veuillez renseigner une adresse email.', true);
    return;
  }

  const submitButton = elements.emailSettingsForm?.querySelector('button[type="submit"]');

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
    showEmailSettingsStatus(error.message || 'Impossible de mettre à jour cette adresse.', true);
  } finally {
    state.settings.saving = false;
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.classList.remove('opacity-50', 'cursor-not-allowed');
    }
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

  courses
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .forEach((course) => {
      const container = document.createElement('div');
      const archived = course.isArchived;
      const baseClasses = 'course-item bg-white p-4 rounded-lg shadow-sm border border-gray-200 transition';
      container.className = `${baseClasses} ${archived ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`;
      container.setAttribute('aria-disabled', archived ? 'true' : 'false');

      const statusClass = archived
        ? 'bg-gray-200 text-gray-600'
        : course.status === 'completed'
        ? 'bg-green-100 text-green-800'
        : 'bg-yellow-100 text-yellow-800';
      const statusLabel = archived
        ? 'Archivée'
        : course.status === 'completed'
        ? 'Terminé'
        : 'À faire';

      container.innerHTML = `
        <div class="flex justify-between items-start">
          <div>
            <div class="font-medium">${course.departure} → ${course.destination}</div>
            <div class="text-sm text-gray-500 mt-1">${formatTime(course.date)} • ${course.merchandise}</div>
          </div>
          <span class="px-2 py-1 text-xs rounded-full ${statusClass}">
            ${statusLabel}
          </span>
        </div>
        ${course.comments ? `<div class="mt-2 text-sm text-gray-600"><i class="fas fa-comment mr-1"></i> ${course.comments}</div>` : ''}
      `;

      if (!archived) {
        container.addEventListener('click', () => openCourseModal(course.id));
      }

      elements.todayList.appendChild(container);
    });
}

function renderWeekCourses() {
  elements.weekList.innerHTML = '';

  if (!state.driverCourses.length) {
    showElement(elements.noCoursesWeek);
    return;
  }

  hideElement(elements.noCoursesWeek);

  state.driverCourses
    .slice()
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .forEach((course) => {
      const row = document.createElement('tr');
      const archived = course.isArchived;
      row.className = `${archived ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'}`;
      row.setAttribute('aria-disabled', archived ? 'true' : 'false');

      const statusClass = archived
        ? 'bg-gray-200 text-gray-600'
        : course.status === 'completed'
        ? 'bg-green-100 text-green-800'
        : 'bg-yellow-100 text-yellow-800';
      const statusLabel = archived
        ? 'Archivée'
        : course.status === 'completed'
        ? 'Terminé'
        : 'À faire';

      row.innerHTML = `
        <td class="px-6 py-4 text-sm sm:whitespace-nowrap" data-label="Date">${formatDate(course.date)}</td>
        <td class="px-6 py-4 text-sm" data-label="Départ">${course.departure}</td>
        <td class="px-6 py-4 text-sm" data-label="Arrivée">${course.destination}</td>
        <td class="px-6 py-4 text-sm sm:whitespace-nowrap" data-label="Horaire">${formatTime(course.date)}</td>
        <td class="px-6 py-4" data-label="Statut">
          <span class="px-2 py-1 text-xs rounded-full ${statusClass}">
            ${statusLabel}
          </span>
        </td>
      `;

      if (!archived) {
        row.addEventListener('click', () => openCourseModal(course.id));
      }

      elements.weekList.appendChild(row);
    });
}

function renderAdminCourses() {
  elements.adminWeekList.innerHTML = '';

  if (!state.adminCourses.length) {
    showElement(elements.noCoursesAdmin);
    return;
  }

  hideElement(elements.noCoursesAdmin);

  state.adminCourses
    .slice()
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .forEach((course) => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-gray-50';
      const statusClass =
        course.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';

      row.innerHTML = `
        <td class="px-6 py-4 text-sm" data-label="Chauffeur">${course.driverName || ''}</td>
        <td class="px-6 py-4 text-sm sm:whitespace-nowrap" data-label="Date">${formatDate(course.date)}</td>
        <td class="px-6 py-4 text-sm" data-label="Départ">${course.departure}</td>
        <td class="px-6 py-4 text-sm" data-label="Arrivée">${course.destination}</td>
        <td class="px-6 py-4 text-sm sm:whitespace-nowrap" data-label="Horaire">${formatTime(course.date)}</td>
        <td class="px-6 py-4" data-label="Statut">
          <span class="px-2 py-1 text-xs rounded-full ${statusClass}">
            ${course.status === 'completed' ? 'Terminé' : 'À faire'}
          </span>
        </td>
        <td class="px-6 py-4 text-sm font-medium sm:text-right" data-label="Actions">
          <div class="flex flex-wrap gap-3 sm:justify-end">
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
        const target = event.target.closest('button');
        if (target && target.dataset.action === 'edit') {
          event.stopPropagation();
          editCourse(course.id);
        } else if (target && target.dataset.action === 'archive') {
          event.stopPropagation();
          archiveCourse(course.id);
        } else if (target && target.dataset.action === 'delete') {
          event.stopPropagation();
          deleteCourse(course.id);
        } else {
          openCourseModal(course.id);
        }
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
    } else if (course.status !== 'completed' && !isArchived) {
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

function openPhotoModal() {
  state.photoDataUrl = null;
  showElement(elements.photoModal);
  hideElement(elements.camera);
  hideElement(elements.photoPreview);
  hideElement(elements.retakePhotoBtn);
  hideElement(elements.confirmPhotoBtn);
  showElement(elements.captureBtn);
  showElement(elements.photoPlaceholder);

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        elements.camera.srcObject = stream;
        elements.camera.play();
        hideElement(elements.photoPlaceholder);
        showElement(elements.camera);
      })
      .catch((error) => {
        console.error('Accès caméra refusé', error);
        elements.photoPlaceholder.innerHTML = `
          <i class="fas fa-camera-slash text-4xl mb-2"></i>
          <p>Impossible d'accéder à l'appareil photo</p>
        `;
      });
  } else {
    elements.photoPlaceholder.innerHTML = `
      <i class="fas fa-camera-slash text-4xl mb-2"></i>
      <p>Appareil photo non disponible</p>
    `;
  }
}

function closePhotoModal() {
  if (elements.camera.srcObject) {
    elements.camera.srcObject.getTracks().forEach((track) => track.stop());
    elements.camera.srcObject = null;
  }

  hideElement(elements.photoModal);
  state.photoDataUrl = null;
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
}

function retakePhoto() {
  state.photoDataUrl = null;
  showElement(elements.camera);
  hideElement(elements.photoPreview);
  hideElement(elements.retakePhotoBtn);
  hideElement(elements.confirmPhotoBtn);
  showElement(elements.captureBtn);
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
  elements.adminDriverSelect.addEventListener('change', () => {
    state.adminFilters.driverId = elements.adminDriverSelect.value || 'all';
    if (state.isAdmin) {
      loadAdminCourses();
    }
  });
  elements.newCourseAdminBtn.addEventListener('click', () => {
    openCourseEditor();
  });
  elements.courseEditorForm.addEventListener('submit', handleCourseEditorSubmit);
  elements.cancelCourseEditorBtn.addEventListener('click', closeCourseEditor);
  elements.closeCourseEditorBtn.addEventListener('click', closeCourseEditor);

  if (elements.adminRangeButtons) {
    elements.adminRangeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const range = button.getAttribute('data-admin-range');
        state.adminFilters.range = range || 'week';
        updateAdminRangeButtons();
        loadAdminCourses();
      });
    });
  }

  elements.adminPlanningTab?.addEventListener('click', () => switchAdminView('planning'));
  elements.adminArchivesTab?.addEventListener('click', () => switchAdminView('archives'));
  elements.adminSettingsTab?.addEventListener('click', () => switchAdminView('settings'));

  elements.closeAdminLoginModalBtn?.addEventListener('click', closeAdminLoginModal);
  elements.adminLoginForm?.addEventListener('submit', handleAdminLogin);
  elements.adminCreateForm?.addEventListener('submit', handleAdminCreate);
  elements.driverManagementForm?.addEventListener('submit', handleAddDriver);
  elements.adminCreateFirstName?.addEventListener('input', updateAdminIdentifierPreview);
  elements.adminCreateLastName?.addEventListener('input', updateAdminIdentifierPreview);

  elements.archivePeriodFilter?.addEventListener('change', handleArchivePeriodChange);
  elements.archiveDriverFilter?.addEventListener('change', handleArchiveFiltersChange);
  elements.archiveMerchandiseFilter?.addEventListener('change', handleArchiveFiltersChange);
  elements.archiveFromInput?.addEventListener('change', handleArchiveDatesChange);
  elements.archiveToInput?.addEventListener('change', handleArchiveDatesChange);
  elements.emailSettingsForm?.addEventListener('submit', handleEmailSettingsSubmit);

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
  });
}

function init() {
  setDefaultCourseDateTime();
  updateAdminRangeButtons();
  updateArchivePeriodInputs();
  registerEventListeners();
}

document.addEventListener('DOMContentLoaded', init);

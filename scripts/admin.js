const storageKeys = {
    content: 'adminContentItems',
    quizzes: 'adminQuizzes',
    users: 'users',
    currentUser: 'currentUser',
    isAdmin: 'isAdmin'
};

const fallbackContentItems = typeof defaultContentItems !== 'undefined' && Array.isArray(defaultContentItems)
    ? defaultContentItems
    : [];

const contentForm = document.getElementById('contentForm');
const quizForm = document.getElementById('quizForm');
const contentTableBody = document.getElementById('contentTableBody');
const quizTableBody = document.getElementById('quizTableBody');
const userTableBody = document.getElementById('userTableBody');
const contentEmpty = document.getElementById('contentEmpty');
const quizEmpty = document.getElementById('quizEmpty');
const userEmpty = document.getElementById('userEmpty');
const quizCourse = document.getElementById('quizCourse');
const quizTitleInput = document.getElementById('quizTitle');
const quizPanelTitle = document.getElementById('quizPanelTitle');
const userSearch = document.getElementById('userSearch');
const userFilter = document.getElementById('userFilter');
const adminNotice = document.getElementById('adminNotice');
const accessLevel = document.getElementById('accessLevel');
const refreshDashboard = document.getElementById('refreshDashboard');
const seedDashboard = document.getElementById('seedDashboard');
const toastContainer = document.getElementById('toastContainer');

const contentCount = document.getElementById('contentCount');
const quizCount = document.getElementById('quizCount');
const userCount = document.getElementById('userCount');
const adminCount = document.getElementById('adminCount');

let contentItems = [];
let quizData = {};
let users = [];
let currentUser = null;
let isAdmin = false;

function initThemeSelector() {
    const themeSelector = document.getElementById('themeSelector');
    const themeButton = document.getElementById('themeButton');
    const themeOptions = document.querySelectorAll('.theme-option');
    const currentTheme = localStorage.getItem('theme') || 'light';

    document.documentElement.setAttribute('data-theme', currentTheme);
    updateActiveThemeOption(themeOptions, currentTheme);

    themeButton.addEventListener('click', (event) => {
        event.stopPropagation();
        themeSelector.classList.toggle('active');
    });

    document.addEventListener('click', (event) => {
        if (!themeSelector.contains(event.target)) {
            themeSelector.classList.remove('active');
        }
    });

    themeOptions.forEach(option => {
        option.addEventListener('click', () => {
            const theme = option.getAttribute('data-theme');
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
            updateActiveThemeOption(themeOptions, theme);
            themeSelector.classList.remove('active');
        });
    });
}

function updateActiveThemeOption(themeOptions, theme) {
    themeOptions.forEach(option => {
        if (option.getAttribute('data-theme') === theme) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
}

function showToast(message, type = 'info') {
    if (!toastContainer) {
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.innerHTML = getToastIcon(type);

    const text = document.createElement('span');
    text.textContent = message;

    toast.append(icon, text);
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4000);
}

function getToastIcon(type) {
    switch (type) {
        case 'success':
            return '<i class="fas fa-check-circle"></i>';
        case 'error':
            return '<i class="fas fa-times-circle"></i>';
        case 'warning':
            return '<i class="fas fa-exclamation-triangle"></i>';
        default:
            return '<i class="fas fa-info-circle"></i>';
    }
}

function requireAdmin(actionLabel) {
    if (isAdmin) {
        return true;
    }

    showToast(`Admin access required to ${actionLabel}.`, 'error');
    return false;
}

function isValidUrl(value) {
    try {
        const url = new URL(value);
        return Boolean(url.protocol && url.host);
    } catch (error) {
        return false;
    }
}

function validateContentItem(item) {
    if (!item.title) {
        return 'Content title is required.';
    }
    if (!item.duration) {
        return 'Estimated duration is required.';
    }
    if (!item.link) {
        return 'Resource link is required.';
    }
    if (!isValidUrl(item.link)) {
        return 'Provide a valid resource link.';
    }
    if (!item.description) {
        return 'Description is required.';
    }

    const duplicate = contentItems.find(entry => {
        return entry.id !== item.id
            && entry.title.toLowerCase() === item.title.toLowerCase()
            && entry.category === item.category;
    });

    if (duplicate) {
        return 'A content item with this title already exists in this category.';
    }

    return '';
}

function validateQuizInput(course, quizTitle, question) {
    if (!course) {
        return 'Select a course.';
    }
    if (!quizTitle) {
        return 'Quiz title is required.';
    }
    if (!question.question) {
        return 'Question text is required.';
    }

    const trimmedOptions = question.options.map(option => option.trim());
    if (trimmedOptions.some(option => option === '')) {
        return 'All answer options are required.';
    }

    const uniqueOptions = new Set(trimmedOptions.map(option => option.toLowerCase()));
    if (uniqueOptions.size !== trimmedOptions.length) {
        return 'Answer options must be unique.';
    }

    if (Number.isNaN(question.correct)) {
        return 'Choose the correct option.';
    }

    return '';
}

function initAdminDashboard() {
    const auth = new Auth();
    currentUser = auth.getCurrentUser();

    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    isAdmin = localStorage.getItem(storageKeys.isAdmin) === 'true' || currentUser.role === 'admin';
    accessLevel.textContent = isAdmin ? 'Admin Active' : 'Admin Required';
    adminNotice.hidden = isAdmin;
    seedDashboard.disabled = !isAdmin;

    if (currentUser.role === 'admin') {
        localStorage.setItem(storageKeys.isAdmin, 'true');
    }

    seedDashboardData();
    contentItems = loadContentItems();
    quizData = loadQuizData();
    users = loadUsers();

    bindContentForm();
    bindQuizForm();
    bindUserFilters();
    bindDashboardActions();

    renderContentItems();
    renderQuizQuestions();
    renderUsers();
    updateSummaryCounts();

    setDashboardEnabled(isAdmin);
}

function seedDashboardData() {
    if (!localStorage.getItem(storageKeys.content)) {
        localStorage.setItem(storageKeys.content, JSON.stringify(fallbackContentItems));
    }

    if (!localStorage.getItem(storageKeys.quizzes)) {
        localStorage.setItem(storageKeys.quizzes, JSON.stringify(defaultQuizData));
    }
}

function loadContentItems() {
    const stored = localStorage.getItem(storageKeys.content);
    if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
            return parsed;
        }
    }

    const fallback = JSON.parse(JSON.stringify(fallbackContentItems));
    localStorage.setItem(storageKeys.content, JSON.stringify(fallback));
    return fallback;
}

function saveContentItems(items) {
    localStorage.setItem(storageKeys.content, JSON.stringify(items));
}

function loadQuizData() {
    const stored = localStorage.getItem(storageKeys.quizzes);
    if (stored) {
        return JSON.parse(stored);
    }
    const fallback = JSON.parse(JSON.stringify(defaultQuizData));
    localStorage.setItem(storageKeys.quizzes, JSON.stringify(fallback));
    return fallback;
}

function saveQuizData(data) {
    localStorage.setItem(storageKeys.quizzes, JSON.stringify(data));
}

function loadUsers() {
    const stored = localStorage.getItem(storageKeys.users);
    if (!stored) {
        return [];
    }

    return JSON.parse(stored).map(user => ({
        ...user,
        role: user.role || 'member'
    }));
}

function saveUsers(updatedUsers) {
    localStorage.setItem(storageKeys.users, JSON.stringify(updatedUsers));
}

function bindContentForm() {
    contentForm.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!requireAdmin('manage learning content')) {
            return;
        }

        const id = document.getElementById('contentId').value || `content-${Date.now()}`;
        const item = {
            id,
            title: document.getElementById('contentTitle').value.trim(),
            category: document.getElementById('contentCategory').value,
            level: document.getElementById('contentLevel').value,
            duration: document.getElementById('contentDuration').value.trim(),
            link: document.getElementById('contentLink').value.trim(),
            description: document.getElementById('contentDescription').value.trim()
        };

        const validationError = validateContentItem(item);
        if (validationError) {
            showToast(validationError, 'error');
            return;
        }

        const existingIndex = contentItems.findIndex(entry => entry.id === id);
        const isUpdate = existingIndex >= 0;
        if (existingIndex >= 0) {
            contentItems[existingIndex] = item;
        } else {
            contentItems.unshift(item);
        }

        saveContentItems(contentItems);
        contentForm.reset();
        document.getElementById('contentId').value = '';
        document.getElementById('contentSubmit').textContent = 'Save Content';
        renderContentItems();
        updateSummaryCounts();
        showToast(isUpdate ? 'Content updated successfully.' : 'Content added successfully.', 'success');
    });

    document.getElementById('contentReset').addEventListener('click', () => {
        document.getElementById('contentId').value = '';
        document.getElementById('contentSubmit').textContent = 'Save Content';
    });
}

function renderContentItems() {
    contentTableBody.innerHTML = '';

    if (contentItems.length === 0) {
        contentEmpty.style.display = 'block';
        return;
    }

    contentEmpty.style.display = 'none';

    contentItems.forEach(item => {
        const row = document.createElement('tr');

        const titleCell = document.createElement('td');
        titleCell.textContent = item.title;

        const categoryCell = document.createElement('td');
        categoryCell.textContent = formatCategory(item.category);

        const levelCell = document.createElement('td');
        levelCell.textContent = item.level;

        const durationCell = document.createElement('td');
        durationCell.textContent = item.duration;

        const actionsCell = document.createElement('td');
        const actionWrapper = document.createElement('div');
        actionWrapper.className = 'table-actions';

        const editButton = document.createElement('button');
        editButton.className = 'action-edit';
        editButton.textContent = 'Edit';
        editButton.addEventListener('click', () => handleContentEdit(item.id));

        const deleteButton = document.createElement('button');
        deleteButton.className = 'action-delete';
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => handleContentDelete(item.id));

        actionWrapper.append(editButton, deleteButton);
        actionsCell.appendChild(actionWrapper);

        row.append(titleCell, categoryCell, levelCell, durationCell, actionsCell);
        contentTableBody.appendChild(row);
    });
}

function handleContentEdit(id) {
    if (!requireAdmin('edit learning content')) {
        return;
    }

    const item = contentItems.find(entry => entry.id === id);
    if (!item) {
        return;
    }

    document.getElementById('contentId').value = item.id;
    document.getElementById('contentTitle').value = item.title;
    document.getElementById('contentCategory').value = item.category;
    document.getElementById('contentLevel').value = item.level;
    document.getElementById('contentDuration').value = item.duration;
    document.getElementById('contentLink').value = item.link;
    document.getElementById('contentDescription').value = item.description;
    document.getElementById('contentSubmit').textContent = 'Update Content';
    showToast(`Editing content: ${item.title}`, 'info');
}

function handleContentDelete(id) {
    if (!requireAdmin('delete learning content')) {
        return;
    }

    if (!confirm('Delete this content item?')) {
        return;
    }

    contentItems = contentItems.filter(entry => entry.id !== id);
    saveContentItems(contentItems);
    renderContentItems();
    updateSummaryCounts();
    showToast('Content removed successfully.', 'success');
}

function bindQuizForm() {
    quizCourse.addEventListener('change', () => {
        updateQuizTitle();
        renderQuizQuestions();
    });

    quizForm.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!requireAdmin('manage quiz questions')) {
            return;
        }

        const course = quizCourse.value;
        const questionIndex = document.getElementById('quizQuestionIndex').value;
        const question = {
            question: document.getElementById('quizQuestion').value.trim(),
            options: [
                document.getElementById('optionA').value.trim(),
                document.getElementById('optionB').value.trim(),
                document.getElementById('optionC').value.trim(),
                document.getElementById('optionD').value.trim()
            ],
            correct: Number.parseInt(document.getElementById('correctOption').value, 10)
        };

        const quizTitle = quizTitleInput.value.trim();
        const validationError = validateQuizInput(course, quizTitle, question);
        if (validationError) {
            showToast(validationError, 'error');
            return;
        }

        if (!quizData[course]) {
            quizData[course] = { title: quizTitle, questions: [] };
        } else if (!Array.isArray(quizData[course].questions)) {
            quizData[course].questions = [];
        }

        quizData[course].title = quizTitle;

        if (questionIndex !== '') {
            quizData[course].questions[Number.parseInt(questionIndex, 10)] = question;
        } else {
            quizData[course].questions.unshift(question);
        }

        saveQuizData(quizData);
        quizForm.reset();
        document.getElementById('quizQuestionIndex').value = '';
        document.getElementById('quizSubmit').textContent = 'Save Question';
        updateQuizTitle();
        renderQuizQuestions();
        updateSummaryCounts();
        showToast(questionIndex !== '' ? 'Quiz question updated.' : 'Quiz question added.', 'success');
    });

    document.getElementById('quizReset').addEventListener('click', () => {
        document.getElementById('quizQuestionIndex').value = '';
        document.getElementById('quizSubmit').textContent = 'Save Question';
        updateQuizTitle();
    });

    updateQuizTitle();
}

function updateQuizTitle() {
    const course = quizCourse.value;
    quizTitleInput.value = quizData[course]?.title || '';
    quizPanelTitle.textContent = `${formatCategory(course)} Questions`;
}

function renderQuizQuestions() {
    const course = quizCourse.value;
    const questions = quizData[course]?.questions || [];
    quizTableBody.innerHTML = '';

    if (questions.length === 0) {
        quizEmpty.style.display = 'block';
        return;
    }

    quizEmpty.style.display = 'none';

    questions.forEach((question, index) => {
        const row = document.createElement('tr');

        const questionCell = document.createElement('td');
        questionCell.textContent = question.question;

        const correctCell = document.createElement('td');
        correctCell.textContent = optionLabel(question.correct);

        const actionsCell = document.createElement('td');
        const actionWrapper = document.createElement('div');
        actionWrapper.className = 'table-actions';

        const editButton = document.createElement('button');
        editButton.className = 'action-edit';
        editButton.textContent = 'Edit';
        editButton.addEventListener('click', () => handleQuizEdit(course, index));

        const deleteButton = document.createElement('button');
        deleteButton.className = 'action-delete';
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => handleQuizDelete(course, index));

        actionWrapper.append(editButton, deleteButton);
        actionsCell.appendChild(actionWrapper);

        row.append(questionCell, correctCell, actionsCell);
        quizTableBody.appendChild(row);
    });
}

function handleQuizEdit(course, index) {
    if (!requireAdmin('edit quiz questions')) {
        return;
    }

    const question = quizData[course]?.questions[index];
    if (!question) {
        return;
    }

    quizCourse.value = course;
    updateQuizTitle();
    document.getElementById('quizQuestionIndex').value = index;
    document.getElementById('quizQuestion').value = question.question;
    document.getElementById('optionA').value = question.options[0];
    document.getElementById('optionB').value = question.options[1];
    document.getElementById('optionC').value = question.options[2];
    document.getElementById('optionD').value = question.options[3];
    document.getElementById('correctOption').value = question.correct.toString();
    document.getElementById('quizSubmit').textContent = 'Update Question';
    showToast('Editing quiz question.', 'info');
}

function handleQuizDelete(course, index) {
    if (!requireAdmin('delete quiz questions')) {
        return;
    }

    if (!confirm('Delete this quiz question?')) {
        return;
    }

    quizData[course].questions.splice(index, 1);
    saveQuizData(quizData);
    renderQuizQuestions();
    updateSummaryCounts();
    showToast('Quiz question removed.', 'success');
}

function bindUserFilters() {
    userSearch.addEventListener('input', renderUsers);
    userFilter.addEventListener('change', renderUsers);
}

function renderUsers() {
    userTableBody.innerHTML = '';
    const query = userSearch.value.toLowerCase();
    const filter = userFilter.value;

    const filteredUsers = users.filter(user => {
        const matchesQuery = `${user.name} ${user.email}`.toLowerCase().includes(query);
        const isUserAdmin = user.role === 'admin';
        if (filter === 'admin' && !isUserAdmin) {
            return false;
        }
        if (filter === 'member' && isUserAdmin) {
            return false;
        }
        return matchesQuery;
    });

    if (filteredUsers.length === 0) {
        userEmpty.style.display = 'block';
        return;
    }

    userEmpty.style.display = 'none';

    filteredUsers.forEach(user => {
        const role = user.role === 'admin' ? 'admin' : 'member';
        const row = document.createElement('tr');

        const nameCell = document.createElement('td');
        nameCell.textContent = user.name;

        const emailCell = document.createElement('td');
        emailCell.textContent = user.email;

        const roleCell = document.createElement('td');
        roleCell.textContent = role === 'admin' ? 'Admin' : 'Member';

        const actionsCell = document.createElement('td');
        const actionWrapper = document.createElement('div');
        actionWrapper.className = 'table-actions';

        const toggleButton = document.createElement('button');
        toggleButton.className = 'action-toggle';
        toggleButton.textContent = role === 'admin' ? 'Revoke Admin' : 'Make Admin';
        toggleButton.disabled = !isAdmin || user.id === currentUser.id;
        toggleButton.addEventListener('click', () => toggleAdmin(user.id));

        const deleteButton = document.createElement('button');
        deleteButton.className = 'action-delete';
        deleteButton.textContent = user.id === currentUser.id ? 'Current User' : 'Remove';
        deleteButton.disabled = !isAdmin || user.id === currentUser.id;
        deleteButton.addEventListener('click', () => removeUser(user.id));

        actionWrapper.append(toggleButton, deleteButton);
        actionsCell.appendChild(actionWrapper);

        row.append(nameCell, emailCell, roleCell, actionsCell);
        userTableBody.appendChild(row);
    });
}

function toggleAdmin(userId) {
    if (!requireAdmin('update user roles')) {
        return;
    }

    if (currentUser && userId === currentUser.id) {
        showToast('You cannot change your own role.', 'warning');
        return;
    }

    const targetUser = users.find(user => user.id === userId);
    if (!targetUser) {
        showToast('User not found.', 'error');
        return;
    }

    const nextRole = targetUser.role === 'admin' ? 'member' : 'admin';
    if (!confirm(`Change ${targetUser.name} to ${nextRole}?`)) {
        return;
    }

    users = users.map(user => {
        if (user.id !== userId) {
            return user;
        }
        const updatedUser = { ...user };
        updatedUser.role = updatedUser.role === 'admin' ? 'member' : 'admin';
        return updatedUser;
    });

    saveUsers(users);
    syncCurrentUser();
    updateSummaryCounts();
    renderUsers();
    showToast(`User role updated to ${nextRole}.`, 'success');
}

function removeUser(userId) {
    if (!requireAdmin('remove users')) {
        return;
    }

    const targetUser = users.find(user => user.id === userId);
    if (!targetUser) {
        showToast('User not found.', 'error');
        return;
    }

    if (!confirm(`Remove ${targetUser.name}?`)) {
        return;
    }

    users = users.filter(user => user.id !== userId);
    saveUsers(users);
    renderUsers();
    updateSummaryCounts();
    showToast('User removed successfully.', 'success');
}

function syncCurrentUser() {
    const updatedCurrent = users.find(user => user.id === currentUser.id);
    if (updatedCurrent) {
        currentUser = updatedCurrent;
        localStorage.setItem(storageKeys.currentUser, JSON.stringify(currentUser));
        if (currentUser.role === 'admin') {
            localStorage.setItem(storageKeys.isAdmin, 'true');
            isAdmin = true;
        } else {
            localStorage.removeItem(storageKeys.isAdmin);
            isAdmin = false;
        }
        accessLevel.textContent = isAdmin ? 'Admin Active' : 'Admin Required';
        adminNotice.hidden = isAdmin;
        seedDashboard.disabled = !isAdmin;
        setDashboardEnabled(isAdmin);
    }
}

function bindDashboardActions() {
    refreshDashboard.addEventListener('click', () => {
        contentItems = loadContentItems();
        quizData = loadQuizData();
        users = loadUsers();
        renderContentItems();
        renderQuizQuestions();
        renderUsers();
        updateSummaryCounts();
        showToast('Dashboard refreshed.', 'info');
    });

    seedDashboard.addEventListener('click', () => {
        if (!requireAdmin('restore demo data')) {
            return;
        }

        if (!confirm('Restore the default demo data?')) {
            return;
        }

        localStorage.setItem(storageKeys.content, JSON.stringify(fallbackContentItems));
        localStorage.setItem(storageKeys.quizzes, JSON.stringify(defaultQuizData));
        contentItems = loadContentItems();
        quizData = loadQuizData();
        renderContentItems();
        renderQuizQuestions();
        updateSummaryCounts();
        showToast('Demo data restored.', 'success');
    });
}

function setDashboardEnabled(enabled) {
    const adminPanels = document.querySelectorAll('.admin-panel');
    adminPanels.forEach(panel => {
        panel.querySelectorAll('input, select, textarea, button').forEach(control => {
            if (control.id === 'refreshDashboard') {
                return;
            }
            if (!enabled) {
                control.setAttribute('disabled', 'disabled');
            } else {
                control.removeAttribute('disabled');
            }
        });
    });
}

function updateSummaryCounts() {
    contentCount.textContent = contentItems.length.toString();

    const totalQuestions = Object.values(quizData).reduce((total, quiz) => {
        return total + (quiz.questions ? quiz.questions.length : 0);
    }, 0);
    quizCount.textContent = totalQuestions.toString();

    userCount.textContent = users.length.toString();
    adminCount.textContent = users.filter(user => user.role === 'admin').length.toString();
}

function formatCategory(category) {
    switch (category) {
        case 'webdev':
            return 'Web Development';
        case 'ai':
            return 'AI & ML';
        case 'career':
            return 'Career';
        default:
            return 'General';
    }
}

function optionLabel(index) {
    return ['A', 'B', 'C', 'D'][index] || 'A';
}

document.addEventListener('DOMContentLoaded', () => {
    initThemeSelector();
    initAdminDashboard();
});

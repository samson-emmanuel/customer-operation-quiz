let currentUser = null;
let currentQuiz = null;
let userAnswers = {};
let timerInterval = null;
let timeLeft = 10 * 60; // 10 minutes in seconds

// Utility function to toggle button loading state
function toggleButtonLoading(button, isLoading) {
    const buttonText = button.querySelector('.button-text');
    const spinner = button.querySelector('.loading-spinner');
    if (buttonText && spinner) {
        if (isLoading) {
            button.disabled = true;
            buttonText.classList.add('hidden');
            spinner.classList.remove('hidden');
        } else {
            button.disabled = false;
            buttonText.classList.remove('hidden');
            spinner.classList.add('hidden');
        }
    }
}

// Show specific page and hide others
function showPage(pageId) {
    const pages = ['login-page', 'forgot-password-page', 'user-dashboard', 'admin-panel', 'quiz-page', 'review-page', 'results-page', 'leaderboard-page'];
    pages.forEach(id => document.getElementById(id).classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
}

// Validate token on page load
async function validateToken(token) {
    try {
        // const response = await fetch('https://customer-operation-quiz-app-812204315267.europe-west1.run.app/api/validate-token', {
        const response = await fetch('https://customer-operation-quiz-app-812204315267.europe-west1.run.app/api/validate-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();
        return response.ok && data.success ? data.user : null;
    } catch (error) {
        console.error('Error validating token:', error);
        return null;
    }
}

// Login
async function login() {
    const button = document.querySelector('#login-page button');
    toggleButtonLoading(button, true);
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const loginError = document.getElementById('login-error');

    if (!emailInput || !passwordInput || !loginError) {
        console.error('Missing DOM elements:', { emailInput: !!emailInput, passwordInput: !!passwordInput, loginError: !!loginError });
        alert('Error: Login form elements not found.');
        toggleButtonLoading(button, false);
        return;
    }

    const email = emailInput.value;
    const password = passwordInput.value;

    if (!email || !password) {
        loginError.classList.remove('hidden');
        loginError.textContent = 'Email and password are required';
        toggleButtonLoading(button, false);
        return;
    }

    try {
        const response = await fetch('https://customer-operation-quiz-app-812204315267.europe-west1.run.app/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            currentUser = data.user;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            if (currentUser.role === 'admin') {
                await showAdminPanel();
            } else {
                await showUserDashboard();
            }
            loginError.classList.add('hidden');
        } else {
            loginError.classList.remove('hidden');
            loginError.textContent = data.message || 'Login failed';
        }
    } catch (error) {
        console.error('Error during login:', error);
        loginError.classList.remove('hidden');
        loginError.textContent = 'Error connecting to server';
    } finally {
        toggleButtonLoading(button, false);
    }
}

// Reset Password
async function resetPassword() {
    const button = document.querySelector('#forgot-password-page button');
    toggleButtonLoading(button, true);
    const email = document.getElementById('forgot-email').value;
    const loginError = document.getElementById('login-error');

    try {
        const response = await fetch('https://customer-operation-quiz-app-812204315267.europe-west1.run.app/api/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await response.json();
        alert(data.message || `Password reset link sent to ${email}`);
        showPage('login-page');
    } catch (error) {
        console.error('Error resetting password:', error);
        loginError.classList.remove('hidden');
        loginError.textContent = 'Error connecting to server';
    } finally {
        toggleButtonLoading(button, false);
    }
}

// Show Forgot Password Page
function showForgotPassword() {
    showPage('forgot-password-page');
    document.getElementById('forgot-email').value = '';
}

// Show User Dashboard
async function showUserDashboard() {
    showPage('user-dashboard');
    document.getElementById('user-name').textContent = currentUser.name;

    try {
        const scoresResponse = await fetch('https://customer-operation-quiz-app-812204315267.europe-west1.run.app/api/scores', {
            headers: { 'Authorization': `Bearer ${currentUser.token}` }
        });
        if (!scoresResponse.ok) {
            document.getElementById('user-scores').innerHTML = '<p class="text-red-500">Failed to load scores</p>';
            return;
        }
        const scores = await scoresResponse.json();
        document.getElementById('user-scores').innerHTML = scores.length
            ? scores.map(score => `
                <div class="bg-white p-4 rounded shadow mb-2">
                    Quiz: ${score.quiz_title}, Score: ${score.score}, Date: ${new Date(score.date).toLocaleString()}
                </div>
            `).join('')
            : '<p>No scores yet</p>';

        const quizzesResponse = await fetch('https://customer-operation-quiz-app-812204315267.europe-west1.run.app/api/quizzes', {
            headers: { 'Authorization': `Bearer ${currentUser.token}` }
        });
        if (!quizzesResponse.ok) {
            document.getElementById('quiz-categories').innerHTML = '<p class="text-red-500">Failed to load quizzes</p>';
            return;
        }
        const quizzes = await quizzesResponse.json();
        document.getElementById('quiz-categories').innerHTML = quizzes.map(quiz => `
            <div class="bg-white p-4 rounded shadow">
                <h3 class="font-semibold">${quiz.title}</h3>
                <p>Category: ${quiz.category}</p>
                <p>Start Time: ${new Date(quiz.start_time).toLocaleString()}</p>
                <button onclick="startQuiz(${quiz.id})" class="bg-blue-500 text-white p-2 rounded mt-2 hover:bg-blue-600">Start Quiz</button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        document.getElementById('quiz-categories').innerHTML = '<p class="text-red-500">Error loading quizzes</p>';
    }
}

// Start Quiz
async function startQuiz(quizId) {
    try {
        const response = await fetch(`https://customer-operation-quiz-app-812204315267.europe-west1.run.app/api/quizzes/${quizId}`, {
            headers: { 'Authorization': `Bearer ${currentUser.token}` }
        });
        if (!response.ok) {
            alert('Failed to load quiz');
            return;
        }
        currentQuiz = await response.json();
        const now = new Date();
        const startTime = new Date(currentQuiz.start_time);
        if (now < startTime) {
            alert(`Quiz starts at ${startTime.toLocaleString()}`);
            return;
        }

        const questionsResponse = await fetch(`https://customer-operation-quiz-app-812204315267.europe-west1.run.app/api/questions?quiz_id=${quizId}`, {
            headers: { 'Authorization': `Bearer ${currentUser.token}` }
        });
        if (!questionsResponse.ok) {
            alert('Failed to load questions');
            return;
        }
        const questions = await questionsResponse.json();
        if (questions.length === 0) {
            alert('No questions available for this quiz');
            return;
        }

        userAnswers = {};
        timeLeft = 10 * 60;
        if (timerInterval) clearInterval(timerInterval);

        showPage('quiz-page');
        document.getElementById('quiz-title-display').textContent = currentQuiz.title;
        document.getElementById('questions').innerHTML = questions.map((question, index) => `
            <div class="bg-white p-4 rounded shadow mb-4">
                <p class="font-semibold">Question ${index + 1}: ${question.question_text}</p>
                <label><input type="radio" name="question-${question.id}" value="1"> ${question.option1}</label><br>
                <label><input type="radio" name="question-${question.id}" value="2"> ${question.option2}</label><br>
                <label><input type="radio" name="question-${question.id}" value="3"> ${question.option3}</label><br>
                <label><input type="radio" name="question-${question.id}" value="4"> ${question.option4}</label>
            </div>
        `).join('');

        const timerElement = document.getElementById('timer');
        timerElement.textContent = '10:00';
        timerInterval = setInterval(() => {
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                timerInterval = null;
                alert('Time is up! Submitting quiz automatically.');
                submitQuiz();
                return;
            }
            timeLeft--;
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);

        questions.forEach(question => {
            const radios = document.getElementsByName(`question-${question.id}`);
            radios.forEach(radio => {
                radio.addEventListener('change', () => {
                    userAnswers[question.id] = parseInt(radio.value);
                });
            });
        });
    } catch (error) {
        console.error('Error starting quiz:', error);
        alert('Error starting quiz');
    }
}

// Review Answers
async function reviewAnswers() {
    if (!currentQuiz) {
        alert('No quiz selected');
        return;
    }

    try {
        const response = await fetch(`https://customer-operation-quiz-app-812204315267.europe-west1.run.app/api/questions?quiz_id=${currentQuiz.id}`, {
            headers: { 'Authorization': `Bearer ${currentUser.token}` }
        });
        if (!response.ok) {
            alert('Failed to load questions for review');
            return;
        }
        const questions = await response.json();
        showPage('review-page');
        document.getElementById('review-questions').innerHTML = questions.map((question, index) => `
            <div class="bg-white p-4 rounded shadow mb-4">
                <p class="font-semibold">Question ${index + 1}: ${question.question_text}</p>
                <p>Option 1: ${question.option1}</p>
                <p>Option 2: ${question.option2}</p>
                <p>Option 3: ${question.option3}</p>
                <p>Option 4: ${question.option4}</p>
                <p class="${userAnswers[question.id] === question.correct_option ? 'text-green-500' : 'text-red-500'}">
                    Your answer: ${userAnswers[question.id] ? question[`option${userAnswers[question.id]}`] : 'Not answered'}
                </p>
                <p class="text-green-500">Correct answer: ${question[`option${question.correct_option}`]}</p>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error reviewing answers:', error);
        alert('Error reviewing answers');
    }
}

// Submit Quiz
async function submitQuiz() {
    const button = document.querySelector('#quiz-page button[onclick="submitQuiz()"], #review-page button[onclick="submitQuiz()"]');
    toggleButtonLoading(button, true);

    if (!currentQuiz) {
        alert('No quiz selected');
        toggleButtonLoading(button, false);
        return;
    }

    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        document.getElementById('timer').textContent = '0:00';
    }

    try {
        const response = await fetch('https://customer-operation-quiz-app-812204315267.europe-west1.run.app/api/submit-quiz', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser.token}`
            },
            body: JSON.stringify({
                quiz_id: currentQuiz.id,
                answers: userAnswers
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            alert(`Failed to submit quiz: ${errorData.message || 'Unknown error'}`);
            toggleButtonLoading(button, false);
            return;
        }

        const result = await response.json();
        const score = result.score;

        showPage('results-page');
        document.getElementById('results').innerHTML = `
            <p class="text-lg">Your score: ${score} / ${Object.keys(userAnswers).length}</p>
            <p class="text-lg">Percentage: ${(score / Object.keys(userAnswers).length * 100).toFixed(2)}%</p>
        `;
    } catch (error) {
        console.error('Error submitting quiz:', error);
        alert('Error submitting quiz');
    } finally {
        toggleButtonLoading(button, false);
    }
}

// Back to Quiz
function backToQuiz() {
    showPage('quiz-page');
}

// Back to Dashboard
function backToDashboard() {
    showPage(currentUser.role === 'admin' ? 'admin-panel' : 'user-dashboard');
}

// Show Leaderboard
async function showLeaderboard() {
    showPage('leaderboard-page');
    try {
        const response = await fetch('https://customer-operation-quiz-app-812204315267.europe-west1.run.app/api/all-scores', {
            headers: { 'Authorization': `Bearer ${currentUser.token}` }
        });
        if (!response.ok) {
            document.getElementById('leaderboard').innerHTML = '<p class="text-red-500">Failed to load leaderboard</p>';
            return;
        }
        const scores = await response.json();
        document.getElementById('leaderboard').innerHTML = scores.length ? scores.map(score => `
            <div class="bg-white p-4 rounded shadow mb-2">
                User: ${score.user_email}, Quiz: ${score.quiz_title}, Score: ${score.score}
            </div>
        `).join('') : '<p>No scores available</p>';
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        document.getElementById('leaderboard').innerHTML = '<p class="text-red-500">Error loading leaderboard</p>';
    }
}

// Show Admin Panel
async function showAdminPanel() {
    showPage('admin-panel');

    const quizSelect = document.getElementById('quiz-select');
    const questionQuizSelect = document.getElementById('question-quiz-select');
    const quizList = document.getElementById('quiz-list');
    const questionList = document.getElementById('question-list');

    try {
        const quizzesResponse = await fetch('https://customer-operation-quiz-app-812204315267.europe-west1.run.app/api/quizzes', {
            headers: { 'Authorization': `Bearer ${currentUser.token}` }
        });
        if (!quizzesResponse.ok) {
            quizSelect.innerHTML = '<option value="">Failed to load quizzes</option>';
            questionQuizSelect.innerHTML = '<option value="">Failed to load quizzes</option>';
            quizList.innerHTML = '<p class="text-red-500">Failed to load quizzes</p>';
            return;
        }
        const quizzes = await quizzesResponse.json();
        quizSelect.innerHTML = `<option value="">Select Quiz</option>` + quizzes.map(quiz => `
            <option value="${quiz.id}">${quiz.title}</option>
        `).join('');
        questionQuizSelect.innerHTML = `<option value="">Select Quiz</option>` + quizzes.map(quiz => `
            <option value="${quiz.id}">${quiz.title}</option>
        `).join('');
        quizList.innerHTML = quizzes.map(quiz => `
            <div class="bg-white p-4 rounded shadow mb-2">
                ${quiz.title} (${quiz.category}, ${new Date(quiz.start_time).toLocaleString()})
                <button onclick="editQuiz(${quiz.id}, '${quiz.title.replace(/'/g, "\\'")}', '${quiz.category.replace(/'/g, "\\'")}', '${quiz.start_time}')" class="bg-blue-500 text-white p-1 rounded ml-2 hover:bg-blue-600">Edit</button>
                <button onclick="deleteQuiz(${quiz.id})" class="bg-red-500 text-white p-1 rounded ml-2 hover:bg-red-600">Delete</button>
            </div>
        `).join('');

        const questionsResponse = await fetch('https://customer-operation-quiz-app-812204315267.europe-west1.run.app/api/questions', {
            headers: { 'Authorization': `Bearer ${currentUser.token}` }
        });
        if (!questionsResponse.ok) {
            questionList.innerHTML = '<p class="text-red-500">Failed to load questions</p>';
            return;
        }
        const questions = await questionsResponse.json();
        const quizMap = new Map(quizzes.map(quiz => [quiz.id, quiz.title]));
        questionList.innerHTML = questions.map(q => `
            <div class="bg-white p-4 rounded shadow mb-2">
                Quiz: ${quizMap.get(q.quiz_id)} | ${q.question_text}
                <button onclick="editQuestion(${q.id}, ${q.quiz_id}, '${q.question_text.replace(/'/g, "\\'")}', '${q.option1.replace(/'/g, "\\'")}', '${q.option2.replace(/'/g, "\\'")}', '${q.option3.replace(/'/g, "\\'")}', '${q.option4.replace(/'/g, "\\'")}', ${q.correct_option})" class="bg-blue-500 text-white p-1 rounded ml-2 hover:bg-blue-600">Edit</button>
                <button onclick="deleteQuestion(${q.id})" class="bg-red-500 text-white p-1 rounded ml-2 hover:bg-red-600">Delete</button>
            </div>
        `).join('');

        const usersResponse = await fetch('https://customer-operation-quiz-app-812204315267.europe-west1.run.app/api/users', {
            headers: { 'Authorization': `Bearer ${currentUser.token}` }
        });
        if (!usersResponse.ok) {
            document.getElementById('user-list').innerHTML = '<p class="text-red-500">Failed to load users</p>';
            return;
        }
        const users = await usersResponse.json();
        document.getElementById('user-list').innerHTML = users.map(user => `
            <div class="bg-white p-4 rounded shadow mb-2">
                ${user.email} (${users.role})
                <button onclick="deleteUser(${user.id})" class="bg-red-500 text-white p-1 rounded ml-2 hover:bg-red-600">Delete</button>
            </div>
        `).join('');

        const scoresResponse = await fetch('https://customer-operation-quiz-app-812204315267.europe-west1.run.app/api/all-scores', {
            headers: { 'Authorization': `Bearer ${currentUser.token}` }
        });
        if (!scoresResponse.ok) {
            document.getElementById('admin-scores').innerHTML = '<p class="text-red-500">Failed to load scores</p>';
            return;
        }
        const scores = await scoresResponse.json();
        document.getElementById('admin-scores').innerHTML = scores.map(score => `
            <div class="bg-white p-4 rounded shadow mb-2">
                User: ${score.user_email}, Quiz: ${score.quiz_title}, Score: ${score.score}
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading admin panel:', error);
    }
}

// Create Quiz
async function createQuiz() {
    const button = document.querySelector('#admin-panel button[onclick="createQuiz()"]');
    toggleButtonLoading(button, true);
    const title = document.getElementById('quiz-title').value;
    const category = document.getElementById('quiz-category').value;
    const startDate = document.getElementById('quiz-start-date').value;
    const startTime = document.getElementById('quiz-start-time').value;
    const quizError = document.getElementById('quiz-error');

    if (!title || !category || !startDate || !startTime) {
        quizError.classList.remove('hidden');
        quizError.textContent = 'All fields are required';
        toggleButtonLoading(button, false);
        return;
    }

    const start_time = `${startDate} ${startTime}:00`;
    try {
        const response = await fetch('https://customer-operation-quiz-app-812204315267.europe-west1.run.app/api/quizzes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser.token}`
            },
            body: JSON.stringify({ title, category, start_time })
        });
        const data = await response.json();
        if (response.ok) {
            quizError.classList.add('hidden');
            document.getElementById('quiz-title').value = '';
            document.getElementById('quiz-category').value = '';
            document.getElementById('quiz-start-date').value = '';
            document.getElementById('quiz-start-time').value = '';
            await showAdminPanel();
        } else {
            quizError.classList.remove('hidden');
            quizError.textContent = data.message || 'Failed to create quiz';
        }
    } catch (error) {
        console.error('Error creating quiz:', error);
        quizError.classList.remove('hidden');
        quizError.textContent = 'Error connecting to server';
    } finally {
        toggleButtonLoading(button, false);
    }
}

// Edit Quiz
function editQuiz(id, title, category, start_time) {
    document.getElementById('edit-quiz-id').value = id;
    document.getElementById('edit-quiz-title').value = title;
    document.getElementById('edit-quiz-category').value = category;
    const [date, time] = start_time.split(' ');
    document.getElementById('edit-quiz-start-date').value = date;
    document.getElementById('edit-quiz-start-time').value = time.slice(0, 5);
    document.getElementById('edit-quiz-form').classList.remove('hidden');
}

// Update Quiz
async function updateQuiz() {
    const button = document.querySelector('#edit-quiz-form button');
    toggleButtonLoading(button, true);
    const id = document.getElementById('edit-quiz-id').value;
    const title = document.getElementById('edit-quiz-title').value;
    const category = document.getElementById('edit-quiz-category').value;
    const startDate = document.getElementById('edit-quiz-start-date').value;
    const startTime = document.getElementById('edit-quiz-start-time').value;
    const quizError = document.getElementById('edit-quiz-error');

    if (!id || !title || !category || !startDate || !startTime) {
        quizError.classList.remove('hidden');
        quizError.textContent = 'All fields are required';
        toggleButtonLoading(button, false);
        return;
    }

    const start_time = `${startDate} ${startTime}:00`;
    try {
        const response = await fetch(`https://customer-operation-quiz-app-812204315267.europe-west1.run.app/api/quizzes/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser.token}`
            },
            body: JSON.stringify({ title, category, start_time })
        });
        const data = await response.json();
        if (response.ok) {
            quizError.classList.add('hidden');
            document.getElementById('edit-quiz-form').classList.add('hidden');
            await showAdminPanel();
        } else {
            quizError.classList.remove('hidden');
            quizError.textContent = data.message || 'Failed to update quiz';
        }
    } catch (error) {
        console.error('Error updating quiz:', error);
        quizError.classList.remove('hidden');
        quizError.textContent = 'Error connecting to server';
    } finally {
        toggleButtonLoading(button, false);
    }
}

// Delete Quiz
async function deleteQuiz(quizId) {
    if (!confirm('Are you sure you want to delete this quiz?')) return;
    try {
        const response = await fetch(`https://customer-operation-quiz-app-812204315267.europe-west1.run.app/api/quizzes/${quizId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${currentUser.token}` }
        });
        if (response.ok) {
            await showAdminPanel();
        } else {
            alert('Failed to delete quiz');
        }
    } catch (error) {
        console.error('Error deleting quiz:', error);
        alert('Error deleting quiz');
    }
}

// Add Question
async function addQuestion() {
    const button = document.querySelector('#admin-panel button[onclick="addQuestion()"]');
    toggleButtonLoading(button, true);
    const quizId = document.getElementById('question-quiz-select').value;
    const questionText = document.getElementById('question-text').value;
    const option1 = document.getElementById('option1').value;
    const option2 = document.getElementById('option2').value;
    const option3 = document.getElementById('option3').value;
    const option4 = document.getElementById('option4').value;
    const correctOption = parseInt(document.getElementById('correct-option').value);
    const questionError = document.getElementById('question-error');

    if (!quizId || !questionText || !option1 || !option2 || !option3 || !option4 || !correctOption) {
        questionError.classList.remove('hidden');
        questionError.textContent = 'All fields are required';
        toggleButtonLoading(button, false);
        return;
    }
    if (correctOption < 1 || correctOption > 4) {
        questionError.classList.remove('hidden');
        questionError.textContent = 'Correct option must be between 1 and 4';
        toggleButtonLoading(button, false);
        return;
    }

    try {
        const response = await fetch('https://customer-operation-quiz-app-812204315267.europe-west1.run.app/api/questions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser.token}`
            },
            body: JSON.stringify({
                quiz_id: quizId,
                question_text: questionText,
                option1,
                option2,
                option3,
                option4,
                correct_option: correctOption
            })
        });
        const data = await response.json();
        if (response.ok) {
            questionError.classList.add('hidden');
            document.getElementById('question-text').value = '';
            document.getElementById('option1').value = '';
            document.getElementById('option2').value = '';
            document.getElementById('option3').value = '';
            document.getElementById('option4').value = '';
            document.getElementById('correct-option').value = '';
            await showAdminPanel();
        } else {
            questionError.classList.remove('hidden');
            questionError.textContent = data.message || 'Failed to add question';
        }
    } catch (error) {
        console.error('Error adding question:', error);
        questionError.classList.remove('hidden');
        questionError.textContent = 'Error connecting to server';
    } finally {
        toggleButtonLoading(button, false);
    }
}

// Edit Question
function editQuestion(id, quizId, questionText, option1, option2, option3, option4, correctOption) {
    document.getElementById('edit-question-id').value = id;
    document.getElementById('edit-question-quiz-id').value = quizId;
    document.getElementById('edit-question-text').value = questionText;
    document.getElementById('edit-option1').value = option1;
    document.getElementById('edit-option2').value = option2;
    document.getElementById('edit-option3').value = option3;
    document.getElementById('edit-option4').value = option4;
    document.getElementById('edit-correct-option').value = correctOption;
    document.getElementById('edit-question-form').classList.remove('hidden');
}

// Update Question
async function updateQuestion() {
    const button = document.querySelector('#edit-question-form button');
    toggleButtonLoading(button, true);
    const questionId = document.getElementById('edit-question-id').value;
    const quizId = document.getElementById('edit-question-quiz-id').value;
    const questionText = document.getElementById('edit-question-text').value;
    const option1 = document.getElementById('edit-option1').value;
    const option2 = document.getElementById('edit-option2').value;
    const option3 = document.getElementById('edit-option3').value;
    const option4 = document.getElementById('edit-option4').value;
    const correctOption = parseInt(document.getElementById('edit-correct-option').value);
    const errorDiv = document.getElementById('edit-question-error');

    if (!quizId || !questionText || !option1 || !option2 || !option3 || !option4 || isNaN(correctOption)) {
        errorDiv.classList.remove('hidden');
        errorDiv.textContent = 'All fields are required';
        toggleButtonLoading(button, false);
        return;
    }
    if (correctOption < 1 || correctOption > 4) {
        errorDiv.classList.remove('hidden');
        errorDiv.textContent = 'Correct option must be between 1 and 4';
        toggleButtonLoading(button, false);
        return;
    }

    try {
        const response = await fetch(`https://customer-operation-quiz-app-812204315267.europe-west1.run.app/api/questions/${questionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser.token}`
            },
            body: JSON.stringify({
                quiz_id: quizId,
                question_text: questionText,
                option1,
                option2,
                option3,
                option4,
                correct_option: correctOption
            })
        });
        const data = await response.json();
        if (response.ok) {
            errorDiv.classList.add('hidden');
            document.getElementById('edit-question-form').classList.add('hidden');
            await showAdminPanel();
        } else {
            errorDiv.classList.remove('hidden');
            errorDiv.textContent = data.message || 'Failed to update question';
        }
    } catch (error) {
        console.error('Error updating question:', error);
        errorDiv.classList.remove('hidden');
        errorDiv.textContent = 'Error connecting to server';
    } finally {
        toggleButtonLoading(button, false);
    }
}

// Delete Question
async function deleteQuestion(questionId) {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
        const response = await fetch(`https://customer-operation-quiz-app-812204315267.europe-west1.run.app/api/questions/${questionId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${currentUser.token}` }
        });
        if (response.ok) {
            await showAdminPanel();
        } else {
            alert('Failed to delete question');
        }
    } catch (error) {
        console.error('Error deleting question:', error);
        alert('Error deleting question');
    }
}

// Add User
async function addUser() {
    const button = document.querySelector('#admin-panel button[onclick="addUser()"]');
    toggleButtonLoading(button, true);
    const email = document.getElementById('new-user-email').value;
    const name = document.getElementById('new-user-name').value;
    const password = document.getElementById('new-user-password').value;
    const role = document.getElementById('new-user-role').value;
    const userError = document.getElementById('user-error');

    if (!email || !name || !password) {
        userError.classList.remove('hidden');
        userError.textContent = 'All fields are required';
        toggleButtonLoading(button, false);
        return;
    }

    try {
        const response = await fetch('https://customer-operation-quiz-app-812204315267.europe-west1.run.app/api/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser.token}`
            },
            body: JSON.stringify({ email, name, password, role })
        });
        const data = await response.json();
        if (response.ok) {
            userError.classList.add('hidden');
            document.getElementById('new-user-email').value = '';
            document.getElementById('new-user-name').value = '';
            document.getElementById('new-user-password').value = '';
            document.getElementById('new-user-role').value = 'user';
            await showAdminPanel();
        } else {
            userError.classList.remove('hidden');
            userError.textContent = data.message || 'Failed to add user';
        }
    } catch (error) {
        console.error('Error adding user:', error);
        userError.classList.remove('hidden');
        userError.textContent = 'Error connecting to server';
    } finally {
        toggleButtonLoading(button, false);
    }
}

// Delete User
async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
        const response = await fetch(`https://customer-operation-quiz-app-812204315267.europe-west1.run.app/api/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${currentUser.token}` }
        });
        if (response.ok) {
            await showAdminPanel();
        } else {
            alert('Failed to delete user');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Error deleting user');
    }
}

// Logout
async function logout() {
    const button = document.querySelector('#user-dashboard button[onclick="logout()"]');
    toggleButtonLoading(button, true);
    try {
        await fetch('https://customer-operation-quiz-app-812204315267.europe-west1.run.app/api/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser.token}`
            }
        });
        currentUser = null;
        currentQuiz = null;
        userAnswers = {};
        localStorage.removeItem('currentUser');
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        showPage('login-page');
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
        document.getElementById('login-error').textContent = '';
        document.getElementById('login-error').classList.add('hidden');
    } catch (error) {
        console.error('Error logging out:', error);
    } finally {
        toggleButtonLoading(button, false);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        const user = JSON.parse(storedUser);
        const validatedUser = await validateToken(user.token);
        if (validatedUser) {
            currentUser = validatedUser;
            if (currentUser.role === 'admin') {
                await showAdminPanel();
            } else {
                await showUserDashboard();
            }
            return;
        } else {
            localStorage.removeItem('currentUser');
        }
    }
    showPage('login-page');
});
const selectLeague = document.getElementById('league');
const selectStatus = document.getElementById('status');
const inputDateFrom = document.getElementById('dateFrom');
const inputDateTo = document.getElementById('dateTo');
const selectMatchDay = document.getElementById('matchday');
const inputSearch = document.getElementById('search');
const selectSort = document.getElementById('sort');
const applyButton = document.getElementById('applyBtn');
const resetButton = document.getElementById('resetBtn');
const resultsDiv = document.getElementById('results');
const messageDiv = document.getElementById('message');

let allMatches = [];
// Load matches from the API and set the default matchDay
async function loadMatches() {
    try {
        const params = new URLSearchParams();
        if (selectLeague.value) {
            params.append('league', selectLeague.value);
        }
        if (inputDateFrom.value) {
            params.append('dateFrom', inputDateFrom.value);
        }
        if (inputDateTo.value) {
            params.append('dateTo', inputDateTo.value);
        }

        messageDiv.textContent = 'Loading matches...';
        const response = await fetch('/api/matches?' + params.toString());
        if (!response.ok) {
            throw new Error(`${response.status} `);
        }
        const data = await response.json();
        allMatches = data.matches;
        const unfinishedStatuses = ['TIMED', 'SCHEDULED', 'IN_PLAY', 'PAUSED'];
        const defaultUpcoming = allMatches.find(item => unfinishedStatuses.includes(item.status));
        if (defaultUpcoming) {
            selectMatchDay.value = defaultUpcoming.matchday;
        }
        render();
    }
    catch (error) {
        console.error('Error loading matches:', error);
    }

}


// Filter and render matches based on selected criteria
function render() {
    let list = [...allMatches];
    if (selectMatchDay.value) {
        list = list.filter(m => m.matchday === parseInt(selectMatchDay.value, 10));
    }
    const searchText = inputSearch.value.trim().toLowerCase();
    if (searchText) {
        list = list.filter(m => m.homeTeam.name.toLowerCase().includes(searchText) || m.awayTeam.name.toLowerCase().includes(searchText));
    }
    const sortOption = selectSort.value;
    switch (sortOption) {
        case 'dateAsc':
            list.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
            break;
        case 'dateDesc':
            list.sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate));
            break;
        case 'TeamAsc':
            list.sort((a, b) => a.homeTeam.name.localeCompare(b.homeTeam.name));
            break;
        case 'TeamDesc':
            list.sort((a, b) => b.homeTeam.name.localeCompare(a.homeTeam.name));
            break;
        default:
            break;
    }
    const statusFilter = selectStatus.value;
    if (statusFilter) {
        list = list.filter(m => m.status === statusFilter);
    }
    if (list.length === 0) {
        messageDiv.textContent = 'No Results Found.';
    }
    else {
        messageDiv.textContent = '';
    }
    resultsDiv.innerHTML = '';
    list.slice(0, 10).forEach(match => {
        const card = document.createElement('div');
        card.className = 'match-card';
        const homeScore = match.score.fullTime.home;
        const awayScore = match.score.fullTime.away;
        const middle = homeScore === null ? 'vs' : `${homeScore} - ${awayScore}`;
        // Div for the TeamsRow
        const teamsRow = document.createElement('div');
        teamsRow.className = 'teams-row';
        const home = document.createElement('span');
        const away = document.createElement('span');
        const score = document.createElement('span');
        home.className = 'home';
        away.className = 'away';
        score.className = 'score';
        home.textContent = `${match.homeTeam.name}`;
        away.textContent = `${match.awayTeam.name}`;
        score.textContent = `${middle}`;

        // Div for the infoRow
        const infoRow = document.createElement('div');
        infoRow.className = 'info-row';
        const date = document.createElement('span');
        const status = document.createElement('span');
        date.className = 'date';
        status.className = 'status';
        date.textContent = `${new Date(match.utcDate).toLocaleString()}`;
        status.textContent = `   ${match.status}`;
        teamsRow.appendChild(home);
        teamsRow.appendChild(score);
        teamsRow.appendChild(away);
        infoRow.appendChild(date);
        infoRow.appendChild(status);

        card.appendChild(infoRow);
        card.appendChild(teamsRow);
        
        resultsDiv.appendChild(card);
    });
}

// Search box
inputSearch.addEventListener('input', function () {
    selectMatchDay.value = '';
    render();
});
// Select matchDay 
selectMatchDay.addEventListener('input', render);
// Sort select box
selectSort.addEventListener('change', render);
// Select status box
selectStatus.addEventListener('change', function () {
    selectMatchDay.value = '';
    render();
});

// Apply button click event
applyButton.addEventListener('click', function () {
    selectMatchDay.value = '';
    loadMatches();
});

// Reset button click event
resetButton.addEventListener('click', function () {
    selectLeague.value = '';
    selectStatus.value = '';
    inputDateFrom.value = '';
    inputDateTo.value = '';
    selectMatchDay.value = '';
    inputSearch.value = '';
    selectSort.value = 'dateAsc';
    loadMatches();
});

// Initial load of matches
loadMatches();

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
const matchesSection = document.getElementById('matchesSection');
const standingsSection = document.getElementById('standingsSection');
const compareSection = document.getElementById('compareSection');
const standingMessage = document.getElementById('standingsMessage');
const standingsDiv = document.getElementById('standingsDiv');
const compareHome = document.getElementById('compareHome');
const compareAway = document.getElementById('compareAway');
const compareMessage = document.getElementById('compareMessage');
const compareDiv = document.getElementById('compareDiv');
const themeButton = document.getElementById('themeBtn');
const menuButton = document.getElementById('menuBtn');
const mainNav = document.getElementById('mainNav');
const navButtons = document.querySelectorAll('nav button[data-tab]');
const homeSection = document.getElementById('homeSection');
const liveMessage = document.getElementById('liveMessage');
const liveDiv = document.getElementById('liveDiv');
const newsMessage = document.getElementById('newsMessage');
const newsDiv = document.getElementById('newsDiv');
const newsSources = document.getElementById('newsSources');
const newsProvider = document.getElementById('newsProvider');

const PAGE_SIZE = 10;
const moreButton = document.getElementById('moreBtn');
const standingsSort = document.getElementById('standingsSort');

// Reads JSON, and gives a clear message if the server sent an HTML page instead
async function readJson(response) {
    try {
        return await response.json();
    }
    catch (error) {
        throw new Error('The server sent an unexpected reply. Restart it with: node server.js');
    }
}

// Team badge: the crest, or the team's initials when there is no crest
function teamBadge(team) {
    const fallback = () => {
        const span = document.createElement('span');
        span.className = 'crest crest-fallback';
        span.textContent = team.name.split(' ').filter(Boolean).map(word => word[0]).join('').slice(0, 3).toUpperCase();
        return span;
    };
    if (!team.crest) {
        return fallback();
    }
    const img = document.createElement('img');
    img.src = team.crest;
    img.alt = '';
    img.className = 'crest';
    img.onerror = () => img.replaceWith(fallback());
    return img;
}

// The badge always sits next to the score: after the name for home, before it for away
function addTeam(container, team) {
    const badge = teamBadge(team);
    const name = document.createTextNode(team.name);
    if (container.classList.contains('home')) {
        container.appendChild(name);
        container.appendChild(badge);
    }
    else {
        container.appendChild(badge);
        container.appendChild(name);
    }
}

let allMatches = [];
let shown = PAGE_SIZE;
let extraMatchdays = [];
let nextMatchday = null;

function resetPaging() {
    shown = PAGE_SIZE;
    extraMatchdays = [];
}

// Matchday to start from: latest finished one for Finished, otherwise the next unplayed one
function defaultMatchday() {
    if (selectStatus.value === 'FINISHED') {
        const finished = allMatches
            .filter(m => m.status === 'FINISHED' && m.matchday)
            .map(m => m.matchday);
        return finished.length > 0 ? Math.max(...finished) : '';
    }
    const unfinishedStatuses = ['TIMED', 'SCHEDULED', 'IN_PLAY', 'PAUSED'];
    const next = allMatches.find(m => unfinishedStatuses.includes(m.status) && m.matchday);
    return next ? next.matchday : '';
}
let appliedLeague = '';
let standingsRows = [];
let standingsLeague = '';
let matchesLeague = '';
let currentTab = 'home';
let newsLeague = null;

// ---------- Theme (dark / light) ----------
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeButton.textContent = theme === 'dark' ? '☀' : '☾';
    themeButton.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {
        localStorage.setItem('theme', next);
    }
    catch (error) {
        console.error('Could not save theme:', error);
    }
}

themeButton.addEventListener('click', toggleTheme);
applyTheme(document.documentElement.getAttribute('data-theme') || 'dark');

// ---------- Hamburger menu (mobile) ----------
menuButton.addEventListener('click', function () {
    const isOpen = mainNav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
    menuButton.textContent = isOpen ? '✕' : '☰';
});

// ---------- Tabs ----------
function showTab(name) {
    currentTab = name;
    document.body.setAttribute('data-tab', name);
    homeSection.classList.toggle('hidden', name !== 'home');
    matchesSection.classList.toggle('hidden', name !== 'matches');
    standingsSection.classList.toggle('hidden', name !== 'standings');
    compareSection.classList.toggle('hidden', name !== 'compare');
    navButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.tab === name);
    });
    // close the mobile menu after choosing a tab
    mainNav.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.textContent = '☰';

    if (name === 'home') {
        loadLive();
        // news is only fetched again when the league changed
        if (newsLeague !== appliedLeague) {
            loadNews();
        }
    }
    else if (name === 'matches') {
        // league may have changed while on another tab
        if (matchesLeague !== (appliedLeague || 'PL')) {
            loadMatches();
        }
    }
    else {
        loadStandings(false);
    }
}

navButtons.forEach(button => {
    button.addEventListener('click', () => showTab(button.dataset.tab));
});

// ---------- Matches ----------
async function loadMatches() {
    try {
        const params = new URLSearchParams();
        if (appliedLeague) {
            params.append('league', appliedLeague);
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
            const err = await readJson(response);
            throw new Error(err.error || response.status);
        }
        const data = await readJson(response);
        allMatches = data.matches;
        matchesLeague = appliedLeague || 'PL';
        resetPaging();
        selectMatchDay.value = defaultMatchday();
        render();
    }
    catch (error) {
        console.error('Error loading matches:', error);
        allMatches = [];
        resultsDiv.innerHTML = '';
        messageDiv.textContent = error.message || 'Could not load matches.';
    }
}

function render() {
    let list = [...allMatches];
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
            // no sort chosen: order by matchday (newest first when looking at finished games)
            list.sort((a, b) => selectStatus.value === 'FINISHED'
                ? b.matchday - a.matchday
                : a.matchday - b.matchday);
            break;
    }
    const statusFilter = selectStatus.value;
    if (statusFilter) {
        list = list.filter(m => m.status === statusFilter);
    }

    // Matchday mode: show the chosen matchday plus any the user loaded with the button
    const matchdayMode = Boolean(selectMatchDay.value);
    nextMatchday = null;
    if (matchdayMode) {
        const visible = [parseInt(selectMatchDay.value, 10), ...extraMatchdays];
        const goingBack = selectStatus.value === 'FINISHED';
        const frontier = goingBack ? Math.min(...visible) : Math.max(...visible);
        const candidates = list
            .map(m => m.matchday)
            .filter(day => day && (goingBack ? day < frontier : day > frontier));
        if (candidates.length > 0) {
            nextMatchday = goingBack ? Math.max(...candidates) : Math.min(...candidates);
        }
        list = list.filter(m => visible.includes(m.matchday));
    }
    messageDiv.textContent = list.length === 0 ? 'No Results Found.' : '';
    resultsDiv.innerHTML = '';
    const visibleList = matchdayMode ? list : list.slice(0, shown);
    visibleList.forEach(match => {
        const card = document.createElement('div');
        card.className = 'match-card';
        const homeScore = match.score.fullTime.home;
        const awayScore = match.score.fullTime.away;
        const middle = homeScore === null ? 'vs' : `${homeScore} - ${awayScore}`;

        const teamsRow = document.createElement('div');
        teamsRow.className = 'teams-row';
        const home = document.createElement('span');
        const away = document.createElement('span');
        const score = document.createElement('span');
        home.className = 'home';
        away.className = 'away';
        score.className = 'score';
        addTeam(home, match.homeTeam);
        addTeam(away, match.awayTeam);
        score.textContent = middle;

        const infoRow = document.createElement('div');
        infoRow.className = 'info-row';
        const date = document.createElement('span');
        const status = document.createElement('span');
        date.className = 'date';
        // fixed: class is now "status finished" so it matches the CSS
        status.className = 'status ' + match.status.toLowerCase();
        date.textContent = new Date(match.utcDate).toLocaleString();
        status.textContent = match.status.replace('_', ' ');

        teamsRow.appendChild(home);
        teamsRow.appendChild(score);
        teamsRow.appendChild(away);
        infoRow.appendChild(date);
        infoRow.appendChild(status);

        card.appendChild(infoRow);
        card.appendChild(teamsRow);
        resultsDiv.appendChild(card);
    });
    if (matchdayMode) {
        moreButton.hidden = nextMatchday === null;
        moreButton.textContent = `Load matchday ${nextMatchday}`;
    }
    else {
        moreButton.hidden = list.length <= shown;
        moreButton.textContent = `Load more (${list.length - shown} left)`;
    }
}

// ---------- Standings ----------
function setStandingsMessage(text) {
    standingMessage.textContent = text;
    compareMessage.textContent = text;
}

// force = true always re-fetches, false reuses the cached table for the same league
async function loadStandings(force) {
    const league = appliedLeague || 'PL';
    if (!force && standingsRows.length > 0 && standingsLeague === league) {
        renderStandings();
        fillCompare();
        return;
    }
    try {
        setStandingsMessage('Loading standings...');
        const response = await fetch('/api/standings?league=' + league);
        if (!response.ok) {
            const err = await readJson(response);
            throw new Error(err.error || 'Could not load standings.');
        }
        const data = await readJson(response);
        const totalTable = data.standings.find(s => s.type === 'TOTAL');
        if (!totalTable) {
            throw new Error('No league table for this competition.');
        }
        standingsRows = totalTable.table;
        standingsLeague = league;
        setStandingsMessage('');
        renderStandings();
        fillCompare();
    }
    catch (error) {
        console.error('Error loading Standings:', error);
        standingsRows = [];
        standingsLeague = '';
        standingsDiv.innerHTML = '';
        compareDiv.innerHTML = '';
        compareHome.innerHTML = '';
        compareAway.innerHTML = '';
        setStandingsMessage(error.message);
    }
}

function renderStandings() {
    const searchText = inputSearch.value.trim().toLowerCase();
    const rows = standingsRows.filter(r => r.team.name.toLowerCase().includes(searchText));

    if (standingsSort.value !== 'position') {
        rows.sort((a, b) => b[standingsSort.value] - a[standingsSort.value]);
    }

    standingsDiv.innerHTML = '';
    if (rows.length === 0) {
        standingMessage.textContent = 'No teams found.';
        return;
    }
    standingMessage.textContent = '';

    const table = document.createElement('table');
    const headerRow = document.createElement('tr');
    const headers = ['Pos', 'Team', 'P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts', 'Form'];
    headers.forEach(heading => {
        const th = document.createElement('th');
        th.textContent = heading;
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    rows.forEach(r => {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.textContent = r.position;
        const teamCell = document.createElement('td');
        teamCell.className = 'team-cell';
        const img = document.createElement('img');
        img.src = r.team.crest;
        img.alt = r.team.name;
        img.className = 'crest';
        const teamName = document.createElement('span');
        teamName.textContent = r.team.name;
        teamCell.appendChild(img);
        teamCell.appendChild(teamName);
        tr.appendChild(td);
        tr.appendChild(teamCell);

        const values = [r.playedGames, r.won, r.draw, r.lost, r.goalsFor, r.goalsAgainst, r.goalDifference, r.points];
        values.forEach(value => {
            const cell = document.createElement('td');
            cell.textContent = value;
            tr.appendChild(cell);
        });

        // Recent form (last 5), the API may not send it for every league
        const formCell = document.createElement('td');
        const formResults = r.form ? r.form.split(',').slice(-5) : [];
        if (formResults.length === 0) {
            formCell.textContent = '—';
        }
        formResults.forEach(result => {
            const badge = document.createElement('span');
            badge.className = 'form-badge ' + result;
            badge.textContent = result;
            formCell.appendChild(badge);
        });
        tr.appendChild(formCell);

        table.appendChild(tr);
    });

    standingsDiv.appendChild(table);
}

// ---------- Compare ----------
function fillCompare() {
    compareHome.innerHTML = '';
    compareAway.innerHTML = '';
    standingsRows.forEach(r => {
        [compareHome, compareAway].forEach(select => {
            const option = document.createElement('option');
            option.value = r.team.id;
            option.textContent = r.team.name;
            select.appendChild(option);
        });
    });
    compareHome.selectedIndex = 0;
    compareAway.selectedIndex = standingsRows.length > 1 ? 1 : 0;
    renderCompare();
}

function renderCompare() {
    compareDiv.innerHTML = '';
    const home = standingsRows.find(r => String(r.team.id) === compareHome.value);
    const away = standingsRows.find(r => String(r.team.id) === compareAway.value);
    if (!home || !away) {
        return;
    }
    if (home === away) {
        compareMessage.textContent = 'Pick two different teams.';
        return;
    }
    compareMessage.textContent = '';

    // [label, field, which side is better: 'high' = bigger wins, 'low' = smaller wins, null = neutral]
    const stats = [
        ['Position', 'position', 'low'],
        ['Played', 'playedGames', null],
        ['Won', 'won', 'high'],
        ['Drawn', 'draw', null],
        ['Lost', 'lost', 'low'],
        ['Goals for', 'goalsFor', 'high'],
        ['Goals against', 'goalsAgainst', 'low'],
        ['Goal difference', 'goalDifference', 'high'],
        ['Points', 'points', 'high']
    ];

    const head = document.createElement('div');
    head.className = 'compare-row compare-head';
    [home, away].forEach((entry, index) => {
        const side = document.createElement('div');
        side.className = 'compare-team';
        const img = document.createElement('img');
        img.src = entry.team.crest;
        img.alt = entry.team.name;
        img.className = 'crest-big';
        const name = document.createElement('strong');
        name.textContent = entry.team.name;
        side.appendChild(img);
        side.appendChild(name);
        head.appendChild(side);
        if (index === 0) {
            head.appendChild(document.createElement('span'));
        }
    });
    compareDiv.appendChild(head);

    stats.forEach(([label, field, better]) => {
        const row = document.createElement('div');
        row.className = 'compare-row';
        const left = document.createElement('span');
        const middle = document.createElement('span');
        const right = document.createElement('span');
        left.textContent = home[field];
        right.textContent = away[field];
        middle.textContent = label;
        middle.className = 'compare-label';

        if (better && home[field] !== away[field]) {
            const homeWins = better === 'high' ? home[field] > away[field] : home[field] < away[field];
            (homeWins ? left : right).classList.add('better');
        }
        row.appendChild(left);
        row.appendChild(middle);
        row.appendChild(right);
        compareDiv.appendChild(row);
    });
}

standingsSort.addEventListener('change', renderStandings);
compareHome.addEventListener('change', renderCompare);
compareAway.addEventListener('change', renderCompare);

// ---------- Home: live matches + news ----------
async function loadLive() {
    try {
        liveMessage.textContent = liveDiv.children.length === 0 ? 'Loading live matches...' : '';
        const response = await fetch('/api/live');
        if (!response.ok) {
            const err = await readJson(response);
            throw new Error(err.error || 'Could not load live matches.');
        }
        const data = await readJson(response);
        renderLive(data.matches);
    }
    catch (error) {
        console.error('Error loading live matches:', error);
        liveDiv.innerHTML = '';
        liveMessage.textContent = error.message;
    }
}

function renderLive(matches) {
    liveDiv.innerHTML = '';
    if (!matches || matches.length === 0) {
        liveMessage.textContent = 'No matches are live right now. Check the Matches tab for upcoming games.';
        return;
    }
    liveMessage.textContent = '';
    matches.forEach(match => {
        const card = document.createElement('div');
        card.className = 'match-card';

        const infoRow = document.createElement('div');
        infoRow.className = 'info-row';
        const competition = document.createElement('span');
        competition.textContent = match.competition.name;
        const status = document.createElement('span');
        status.className = 'status ' + match.status.toLowerCase();
        status.textContent = match.minute ? `${match.minute}'` : match.status.replace('_', ' ');
        infoRow.appendChild(competition);
        infoRow.appendChild(status);

        const teamsRow = document.createElement('div');
        teamsRow.className = 'teams-row';
        const home = document.createElement('span');
        const away = document.createElement('span');
        const score = document.createElement('span');
        home.className = 'home';
        away.className = 'away';
        score.className = 'score';
        addTeam(home, match.homeTeam);
        addTeam(away, match.awayTeam);
        const homeScore = match.score.fullTime.home;
        const awayScore = match.score.fullTime.away;
        score.textContent = homeScore === null ? '0 - 0' : `${homeScore} - ${awayScore}`;
        teamsRow.appendChild(home);
        teamsRow.appendChild(score);
        teamsRow.appendChild(away);

        card.appendChild(infoRow);
        card.appendChild(teamsRow);
        liveDiv.appendChild(card);
    });
}

async function loadNews() {
    try {
        newsMessage.textContent = 'Loading news...';
        const league = appliedLeague;
        const response = await fetch('/api/news?league=' + league);
        if (!response.ok) {
            const err = await readJson(response);
            throw new Error(err.error || 'Could not load news.');
        }
        const data = await readJson(response);
        newsLeague = league;
        renderNews(data);
    }
    catch (error) {
        console.error('Error loading news:', error);
        newsDiv.innerHTML = '';
        newsSources.innerHTML = '';
        newsMessage.textContent = error.message;
    }
}

function renderNews(data) {
    newsProvider.textContent = data.provider || '';
    newsDiv.innerHTML = '';
    newsSources.innerHTML = '';
    if (!Array.isArray(data.articles) || data.articles.length === 0) {
        newsMessage.textContent = 'No news found.';
        return;
    }
    newsMessage.textContent = '';
    data.articles.forEach(article => {
        const card = document.createElement('article');
        card.className = 'news-card';
        const title = document.createElement('h3');
        if (article.url && /^https?:\/\//.test(article.url)) {
            const link = document.createElement('a');
            link.href = article.url;
            link.textContent = article.title;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            title.appendChild(link);
        }
        else {
            title.textContent = article.title;
        }
        const summary = document.createElement('p');
        summary.textContent = article.summary;
        card.appendChild(title);
        card.appendChild(summary);
        const details = [];
        if (article.source) {
            details.push(article.source);
        }
        if (article.published) {
            details.push(new Date(article.published).toLocaleString());
        }
        if (details.length > 0) {
            const info = document.createElement('small');
            info.textContent = details.join(' • ');
            card.appendChild(info);
        }
        // link to the real article
        if (article.url && /^https?:\/\//.test(article.url)) {
            const more = document.createElement('a');
            more.className = 'read-more';
            more.href = article.url;
            more.textContent = 'Read full article';
            more.target = '_blank';
            more.rel = 'noopener noreferrer';
            card.appendChild(more);
        }
        newsDiv.appendChild(card);
    });

    if (Array.isArray(data.sources) && data.sources.length > 0) {
        const label = document.createElement('span');
        label.textContent = 'Sources: ';
        newsSources.appendChild(label);
        data.sources.forEach(source => {
            if (!/^https?:\/\//.test(source.uri)) {
                return;
            }
            const link = document.createElement('a');
            link.href = source.uri;
            link.textContent = source.title || source.uri;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            newsSources.appendChild(link);
        });
    }
}

// keep live scores fresh while the Home tab is open
setInterval(function () {
    if (currentTab === 'home' && !document.hidden) {
        loadLive();
    }
}, 60000);

// ---------- Shared filters ----------
// Apply reloads whichever tab is open
function applyFilters() {
    appliedLeague = selectLeague.value;
    resetPaging();
    selectMatchDay.value = '';
    if (currentTab === 'home') {
        loadNews();
    }
    else if (currentTab === 'matches') {
        loadMatches();
    }
    else {
        loadStandings(true);
    }
}

inputSearch.addEventListener('input', function () {
    if (currentTab === 'matches') {
        resetPaging();
        // searching looks through every matchday; clearing the search goes back to the current one
        selectMatchDay.value = inputSearch.value.trim() ? '' : defaultMatchday();
        render();
    }
    else if (currentTab === 'standings') {
        renderStandings();
    }
});
selectMatchDay.addEventListener('input', function () {
    resetPaging();
    render();
});
selectSort.addEventListener('change', function () {
    shown = PAGE_SIZE;
    render();
});
moreButton.addEventListener('click', function () {
    if (selectMatchDay.value) {
        extraMatchdays.push(nextMatchday);
    }
    else {
        shown += PAGE_SIZE;
    }
    render();
});
selectStatus.addEventListener('change', function () {
    resetPaging();
    selectMatchDay.value = inputSearch.value.trim() ? '' : defaultMatchday();
    render();
});
applyButton.addEventListener('click', applyFilters);

resetButton.addEventListener('click', function () {
    selectLeague.value = '';
    selectStatus.value = '';
    inputDateFrom.value = '';
    inputDateTo.value = '';
    selectMatchDay.value = '';
    inputSearch.value = '';
    selectSort.value = 'dateAsc';
    standingsSort.value = 'position';
    applyFilters();
});

// Start on the Home tab
showTab('home');
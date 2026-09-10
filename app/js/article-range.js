/* ================================================================
   MEDIUM ARTICLE RANGE EXPLORER
   ================================================================

   File:
       app/js/article-range.js

   Purpose:
       Controls the complete Article Range Explorer frontend.

   IMPORTANT ARCHITECTURE
   ----------------------
   articles.json is treated as the authoritative archive.

   The application performs these operations in this order:

       1. Load archive
       2. Normalize article data
       3. Sort by publication date
       4. Assign permanent article numbers
       5. Apply search/filtering
       6. Apply discovery/sorting
       7. Apply article range
       8. Apply pagination
       9. Render results

   Therefore:

       Article #1 = oldest article
       Article #2 = second oldest
       Article #N = newest article

   Filtering or sorting NEVER changes articleNumber.

   ================================================================ */


/* ================================================================
   APPLICATION CONFIGURATION
   ================================================================ */

const CONFIG = {

    // Local authoritative article archive.
    localArchiveUrl: "data/articles.json",

    // RSS fallback service.
    rss2jsonEndpoint:
        "https://api.rss2json.com/v1/api.json?rss_url=",

    // Number of articles moved by Previous / Next.
    navigationStep: 10,

    // GitHub profile used by the header.
    githubUsername: "awsrmmustansarjavaid",

    // GitHub public API.
    githubApiUrl:
        "https://api.github.com/users/awsrmmustansarjavaid",

    // localStorage prefix.
    storagePrefix:
        "mediumArticleRange",

    // Default page size.
    defaultPageSize: 20

};


/* ================================================================
   APPLICATION STATE
   ================================================================ */

let allArticles = [];

let numberedArticles = [];

let filteredArticles = [];

let displayedArticles = [];

let currentFrom = 1;

let currentTo = 10;

let currentPage = 1;

let pageSize = CONFIG.defaultPageSize;

let currentView = "grid";

let comparisonSelection = [];

let favorites = new Set();


/* ================================================================
   DOM REFERENCES
   ================================================================ */

const profileUrlInput =
    document.getElementById("profileUrl");

const discoveryMode =
    document.getElementById("discoveryMode");

const keywordInput =
    document.getElementById("keywordInput");

const sortSelector =
    document.getElementById("sortSelector");

const fromYear =
    document.getElementById("fromYear");

const fromMonth =
    document.getElementById("fromMonth");

const toYear =
    document.getElementById("toYear");

const toMonth =
    document.getElementById("toMonth");

const fromDate =
    document.getElementById("fromDate");

const toDate =
    document.getElementById("toDate");

const readingTimeFilter =
    document.getElementById("readingTimeFilter");

const topicFilter =
    document.getElementById("topicFilter");

const fromArticleInput =
    document.getElementById("fromArticle");

const toArticleInput =
    document.getElementById("toArticle");

const rangePreviewText =
    document.getElementById("rangePreviewText");

const quickRangeButtons =
    document.querySelectorAll(".quick-range-btn");

const loadArticlesBtn =
    document.getElementById("loadArticlesBtn");

const resetRangeBtn =
    document.getElementById("resetRangeBtn");

const statusBox =
    document.getElementById("statusBox");

const selectedRangeLabel =
    document.getElementById("selectedRangeLabel");

const resultSummary =
    document.getElementById("resultSummary");

const visibleArticleCount =
    document.getElementById("visibleArticleCount");

const currentRangeText =
    document.getElementById("currentRangeText");

const previousRangeBtn =
    document.getElementById("previousRangeBtn");

const nextRangeBtn =
    document.getElementById("nextRangeBtn");

const articleResults =
    document.getElementById("articleResults");

const themeButton =
    document.getElementById("themeButton");

const gridViewButton =
    document.getElementById("gridViewButton");

const listViewButton =
    document.getElementById("listViewButton");

const pageSizeSelect =
    document.getElementById("pageSize");

const paginationControls =
    document.getElementById("paginationControls");

const comparisonSection =
    document.getElementById("comparisonSection");

const comparisonContent =
    document.getElementById("comparisonContent");


/* ================================================================
   INITIALIZATION
   ================================================================ */

initialize();


function initialize() {

    restorePreferences();

    populateMonthOptions();

    attachEventListeners();

    updateRangePreview();

    updateQuickRangeState();

    updateNavigationButtons();

    loadGitHubProfile();

}


/* ================================================================
   EVENT LISTENERS
   ================================================================ */

function attachEventListeners() {

    loadArticlesBtn.addEventListener(
        "click",
        loadArticles
    );

    resetRangeBtn.addEventListener(
        "click",
        resetApplication
    );


    // Range inputs.
    fromArticleInput.addEventListener(
        "input",
        handleRangeInputChange
    );

    toArticleInput.addEventListener(
        "input",
        handleRangeInputChange
    );


    // Search/filter controls automatically update loaded results.
    [
        discoveryMode,
        sortSelector,
        fromYear,
        fromMonth,
        toYear,
        toMonth,
        fromDate,
        toDate,
        readingTimeFilter,
        topicFilter
    ].forEach(control => {

        control.addEventListener(
            "change",
            () => {

                savePreferences();

                if (numberedArticles.length > 0) {

                    currentPage = 1;

                    applyAllFiltersAndRender();
                }
            }
        );
    });


    keywordInput.addEventListener(
        "input",
        debounce(() => {

            savePreferences();

            if (numberedArticles.length > 0) {

                currentPage = 1;

                applyAllFiltersAndRender();
            }

        }, 250)
    );


    // Keyword mode and search scope.
    document
        .querySelectorAll(
            'input[name="keywordMode"], input[name="searchScope"]'
        )
        .forEach(input => {

            input.addEventListener(
                "change",
                () => {

                    savePreferences();

                    if (numberedArticles.length > 0) {

                        currentPage = 1;

                        applyAllFiltersAndRender();
                    }
                }
            );
        });


    // Quick ranges.
    quickRangeButtons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                let from =
                    button.dataset.from;

                let to =
                    button.dataset.to;


                // Special Last 10 range.
                if (
                    from === "last" &&
                    numberedArticles.length > 0
                ) {

                    to =
                        numberedArticles.length;

                    from =
                        Math.max(
                            1,
                            to - 9
                        );
                }


                setRange(
                    Number(from),
                    Number(to)
                );


                if (
                    numberedArticles.length > 0
                ) {

                    currentPage = 1;

                    applyAllFiltersAndRender();
                }
            }
        );
    });


    // Previous / Next.
    previousRangeBtn.addEventListener(
        "click",
        showPreviousRange
    );

    nextRangeBtn.addEventListener(
        "click",
        showNextRange
    );


    // Theme.
    themeButton.addEventListener(
        "click",
        toggleTheme
    );


    // Grid/list.
    gridViewButton.addEventListener(
        "click",
        () => setView("grid")
    );

    listViewButton.addEventListener(
        "click",
        () => setView("list")
    );


    // Page size.
    pageSizeSelect.addEventListener(
        "change",
        () => {

            pageSize =
                Number(pageSizeSelect.value) || 20;

            currentPage = 1;

            savePreferences();

            renderCurrentResults();
        }
    );


    // Save profile.
    profileUrlInput.addEventListener(
        "change",
        savePreferences
    );


    // Enter in range fields.
    [
        fromArticleInput,
        toArticleInput
    ].forEach(input => {

        input.addEventListener(
            "keydown",
            event => {

                if (event.key === "Enter") {

                    event.preventDefault();

                    loadArticles();
                }
            }
        );
    });

}


/* ================================================================
   DEBOUNCE
   ================================================================ */

function debounce(callback, delay) {

    let timer;

    return (...args) => {

        clearTimeout(timer);

        timer =
            setTimeout(
                () => callback(...args),
                delay
            );
    };
}


/* ================================================================
   TEXT NORMALIZATION
   ================================================================ */

function normalizeText(value) {

    return String(value || "")
        .toLowerCase()
        .normalize("NFKC")
        .trim();
}


/* ================================================================
   HTML ESCAPING
   ================================================================ */

function escapeHtml(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* ================================================================
   URL ESCAPING
   ================================================================ */

function safeUrl(value) {

    const valueString =
        String(value || "").trim();

    if (!valueString) {
        return "#";
    }

    try {

        const parsed =
            new URL(valueString);

        if (
            parsed.protocol === "http:" ||
            parsed.protocol === "https:"
        ) {
            return escapeHtml(parsed.href);
        }

    } catch {
        return "#";
    }

    return "#";
}


/* ================================================================
   LOCAL STORAGE
   ================================================================ */

function savePreferences() {

    const keywordMode =
        document.querySelector(
            'input[name="keywordMode"]:checked'
        )?.value || "any";

    const searchScope =
        document.querySelector(
            'input[name="searchScope"]:checked'
        )?.value || "title-content";


    const preferences = {

        profileUrl:
            profileUrlInput.value.trim(),

        discoveryMode:
            discoveryMode.value,

        keyword:
            keywordInput.value,

        keywordMode,

        searchScope,

        sort:
            sortSelector.value,

        fromYear:
            fromYear.value,

        fromMonth:
            fromMonth.value,

        toYear:
            toYear.value,

        toMonth:
            toMonth.value,

        fromDate:
            fromDate.value,

        toDate:
            toDate.value,

        readingTime:
            readingTimeFilter.value,

        topic:
            topicFilter.value,

        fromArticle:
            currentFrom,

        toArticle:
            currentTo,

        pageSize,

        view:
            currentView
    };


    localStorage.setItem(
        `${CONFIG.storagePrefix}Preferences`,
        JSON.stringify(preferences)
    );
}


/* ================================================================
   RESTORE PREFERENCES
   ================================================================ */

function restorePreferences() {

    // Restore favorites.
    try {

        const savedFavorites =
            JSON.parse(
                localStorage.getItem(
                    `${CONFIG.storagePrefix}Favorites`
                ) || "[]"
            );

        favorites =
            new Set(
                Array.isArray(savedFavorites)
                    ? savedFavorites
                    : []
            );

    } catch {

        favorites = new Set();
    }


    // Restore theme.
    const savedTheme =
        localStorage.getItem(
            `${CONFIG.storagePrefix}Theme`
        );

    if (savedTheme === "dark") {

        document.body.classList.add(
            "dark-mode"
        );

        updateThemeButton(true);

    } else {

        updateThemeButton(false);
    }


    // Restore normal controls.
    try {

        const saved =
            JSON.parse(
                localStorage.getItem(
                    `${CONFIG.storagePrefix}Preferences`
                ) || "null"
            );

        if (!saved) {
            return;
        }


        profileUrlInput.value =
            saved.profileUrl || "";

        discoveryMode.value =
            saved.discoveryMode || "oldest";

        keywordInput.value =
            saved.keyword || "";

        sortSelector.value =
            saved.sort || "archive";

        fromYear.value =
            saved.fromYear || "";

        fromMonth.value =
            saved.fromMonth || "";

        toYear.value =
            saved.toYear || "";

        toMonth.value =
            saved.toMonth || "";

        fromDate.value =
            saved.fromDate || "";

        toDate.value =
            saved.toDate || "";

        readingTimeFilter.value =
            saved.readingTime || "all";

        fromArticleInput.value =
            saved.fromArticle || 1;

        toArticleInput.value =
            saved.toArticle || 10;

        currentFrom =
            Number(saved.fromArticle) || 1;

        currentTo =
            Number(saved.toArticle) || 10;

        pageSize =
            Number(saved.pageSize) ||
            CONFIG.defaultPageSize;

        pageSizeSelect.value =
            String(pageSize);

        setView(
            saved.view === "list"
                ? "list"
                : "grid"
        );


        if (saved.keywordMode) {

            const keywordMode =
                document.querySelector(
                    `input[name="keywordMode"][value="${CSS.escape(saved.keywordMode)}"]`
                );

            if (keywordMode) {
                keywordMode.checked = true;
            }
        }


        if (saved.searchScope) {

            const scope =
                document.querySelector(
                    `input[name="searchScope"][value="${CSS.escape(saved.searchScope)}"]`
                );

            if (scope) {
                scope.checked = true;
            }
        }

    } catch (error) {

        console.info(
            "Saved preferences could not be restored.",
            error
        );
    }

}


/* ================================================================
   SAVE FAVORITES
   ================================================================ */

function saveFavorites() {

    localStorage.setItem(
        `${CONFIG.storagePrefix}Favorites`,
        JSON.stringify(
            [...favorites]
        )
    );
}


/* ================================================================
   GITHUB PROFILE
   ================================================================ */

async function loadGitHubProfile() {

    const avatar =
        document.getElementById(
            "githubAvatar"
        );

    const fallback =
        document.getElementById(
            "githubAvatarFallback"
        );

    const name =
        document.getElementById(
            "githubName"
        );

    const bio =
        document.getElementById(
            "githubBio"
        );

    const repos =
        document.getElementById(
            "githubRepos"
        );

    const profileLink =
        document.getElementById(
            "githubProfileLink"
        );


    try {

        const response =
            await fetch(
                CONFIG.githubApiUrl,
                {
                    cache: "no-store"
                }
            );

        if (!response.ok) {
            throw new Error(
                `GitHub API returned ${response.status}`
            );
        }

        const data =
            await response.json();


        if (data.avatar_url) {

            avatar.src =
                data.avatar_url;

            avatar.style.display =
                "block";

            fallback.style.display =
                "none";
        }


        name.textContent =
            data.name ||
            data.login ||
            CONFIG.githubUsername;

        bio.textContent =
            data.bio ||
            "Medium Article Archive & Developer Explorer";

        repos.textContent =
            `${Number(data.public_repos) || 0} public repositories`;

        profileLink.href =
            data.html_url ||
            `https://github.com/${CONFIG.githubUsername}`;

    } catch (error) {

        // Public GitHub data is optional.
        // Keep the visual fallback when the API is unavailable.

        console.info(
            "GitHub profile could not be loaded.",
            error
        );

        avatar.style.display =
            "none";

        fallback.style.display =
            "grid";
    }
}


/* ================================================================
   BUILD MEDIUM RSS URL
   ================================================================ */

function buildFeedUrl(profileUrl) {

    let cleanUrl =
        String(profileUrl || "").trim();


    if (!cleanUrl) {

        throw new Error(
            "Please enter your Medium profile URL."
        );
    }


    if (
        !/^https?:\/\//i.test(
            cleanUrl
        )
    ) {

        cleanUrl =
            `https://${cleanUrl}`;
    }


    let url;

    try {

        url =
            new URL(cleanUrl);

    } catch {

        throw new Error(
            "The Medium profile URL is not valid."
        );
    }


    if (
        url.hostname ===
        "medium.com"
    ) {

        const parts =
            url.pathname
                .split("/")
                .filter(Boolean);


        if (
            parts.length === 0 ||
            !parts[0].startsWith("@")
        ) {

            throw new Error(
                "Use a Medium profile such as https://medium.com/@username"
            );
        }


        return (
            "https://medium.com/feed/" +
            parts[0]
        );
    }


    if (
        url.hostname.endsWith(
            ".medium.com"
        )
    ) {

        return (
            `https://${url.hostname}/feed`
        );
    }


    throw new Error(
        "Please enter a valid Medium profile URL."
    );
}


/* ================================================================
   LOAD ARTICLES
   ================================================================ */

async function loadArticles() {

    const profileUrl =
        profileUrlInput.value.trim();


    if (!profileUrl) {

        showStatus(
            "Please enter a Medium profile URL.",
            "warning"
        );

        profileUrlInput.focus();

        return;
    }


    if (!validateRange()) {
        return;
    }


    try {

        setLoadingState(true);

        savePreferences();


        showStatus(
            "Loading the article archive...",
            "secondary"
        );


        // ==========================================================
        // FIRST SOURCE: LOCAL ARCHIVE
        // ==========================================================

        let localArticles =
            await loadLocalArchive();


        if (
            localArticles.length > 0
        ) {

            allArticles =
                localArticles;

            showStatus(
                `Loaded ${allArticles.length} article(s) from articles.json.`,
                "success"
            );

        } else {

            // ======================================================
            // SECOND SOURCE: MEDIUM RSS
            // ======================================================

            showStatus(
                "Local archive is empty. Loading Medium RSS...",
                "secondary"
            );


            allArticles =
                await loadMediumRSS(
                    profileUrl
                );


            showStatus(
                `Loaded ${allArticles.length} article(s) from Medium RSS.`,
                "success"
            );
        }


        // Normalize.
        allArticles =
            normalizeArticles(
                allArticles
            );


        // ==========================================================
        // PERMANENT CHRONOLOGICAL NUMBERING
        // ==========================================================

        numberedArticles =
            numberArticles(
                allArticles
            );


        if (
            numberedArticles.length === 0
        ) {

            throw new Error(
                "No valid articles with usable publication dates were found."
            );
        }


        // Build filter options.
        populateYearOptions();

        populateTopicOptions();


        // Make range safe.
        adjustRangeToAvailableArticles();


        // Calculate statistics.
        renderStatistics();


        // Render.
        currentPage = 1;

        applyAllFiltersAndRender();


    } catch (error) {

        console.error(
            "Article Range Error:",
            error
        );


        allArticles = [];

        numberedArticles = [];

        filteredArticles = [];

        displayedArticles = [];


        renderErrorState(
            error.message
        );


        showStatus(
            error.message,
            "danger"
        );

    } finally {

        setLoadingState(false);
    }

}


/* ================================================================
   LOAD LOCAL ARCHIVE
   ================================================================ */

async function loadLocalArchive() {

    try {

        const response =
            await fetch(
                CONFIG.localArchiveUrl,
                {
                    method: "GET",
                    cache: "no-store"
                }
            );


        if (!response.ok) {
            return [];
        }


        const data =
            await response.json();


        if (
            Array.isArray(data)
        ) {

            return data;
        }


        if (
            data &&
            Array.isArray(data.articles)
        ) {

            return data.articles;
        }


        return [];

    } catch (error) {

        console.info(
            "Local article archive unavailable.",
            error
        );

        return [];
    }
}


/* ================================================================
   LOAD MEDIUM RSS
   ================================================================ */

async function loadMediumRSS(
    profileUrl
) {

    const feedUrl =
        buildFeedUrl(
            profileUrl
        );


    const apiUrl =
        CONFIG.rss2jsonEndpoint +
        encodeURIComponent(
            feedUrl
        );


    const response =
        await fetch(
            apiUrl,
            {
                method: "GET",
                cache: "no-store"
            }
        );


    if (!response.ok) {

        throw new Error(
            `RSS service returned HTTP ${response.status}.`
        );
    }


    const data =
        await response.json();


    if (
        data.status !== "ok"
    ) {

        throw new Error(
            data.message ||
            "The Medium RSS feed could not be loaded."
        );
    }


    return Array.isArray(data.items)
        ? data.items
        : [];
}


/* ================================================================
   NORMALIZE ARTICLES
   ================================================================ */

function normalizeArticles(
    articles
) {

    const normalized = [];


    for (
        const article of articles
    ) {

        if (!article) {
            continue;
        }


        const title =
            String(
                article.title ||
                "Untitled Article"
            ).trim();


        const link =
            String(
                article.link ||
                article.url ||
                ""
            ).trim();


        const pubDate =
            article.pubDate ||
            article.published ||
            article.publishedAt ||
            article.date ||
            article.publishedAtUtc ||
            "";


        const parsedDate =
            new Date(pubDate);


        if (
            Number.isNaN(
                parsedDate.getTime()
            )
        ) {

            continue;
        }


        const description =
            stripHtml(
                article.description ||
                article.content ||
                article.summary ||
                article.excerpt ||
                ""
            );


        // ==========================================================
        // COVER IMAGE
        // ==========================================================

        const image =
            article.image ||
            article.thumbnail ||
            article.cover ||
            article.coverImage ||
            article.featuredImage ||
            (
                article.enclosure &&
                article.enclosure.link
            ) ||
            extractImageFromHtml(
                article.content
            ) ||
            extractImageFromHtml(
                article.description
            ) ||
            "";


        // ==========================================================
        // TOPICS / TAGS
        // ==========================================================

        const topics =
            normalizeTopics(
                article.topics ||
                article.tags ||
                article.categories ||
                article.category ||
                ""
            );


        // ==========================================================
        // READING TIME
        // ==========================================================

        const readingTime =
            parseMetric(
                article.readingTime ||
                article.readTime ||
                article.reading_time ||
                article.minutes
            );


        // ==========================================================
        // POPULARITY METRICS
        // ==========================================================

        const views =
            parseMetric(
                article.views ||
                article.viewCount ||
                article.view_count
            );

        const reads =
            parseMetric(
                article.reads ||
                article.readCount ||
                article.read_count
            );

        const comments =
            parseMetric(
                article.comments ||
                article.commentCount ||
                article.comment_count
            );

        const claps =
            parseMetric(
                article.claps ||
                article.recommends ||
                article.recommendations ||
                article.applause ||
                article.clapCount
            );


        normalized.push({

            // Core article information.
            title,
            link,
            pubDate:
                parsedDate.toISOString(),
            description,
            image,

            // Additional metadata.
            topics,

            readingTime,

            views,
            reads,
            comments,
            claps

        });
    }


    return normalized;
}


/* ================================================================
   PARSE NUMERIC METRICS
   ================================================================ */

function parseMetric(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return null;
    }


    const number =
        Number(
            String(value)
                .replace(/,/g, "")
                .replace(/[^\d.-]/g, "")
        );


    return Number.isFinite(number)
        ? number
        : null;
}


/* ================================================================
   NORMALIZE TOPICS
   ================================================================ */

function normalizeTopics(value) {

    if (
        Array.isArray(value)
    ) {

        return [
            ...new Set(
                value
                    .map(
                        item =>
                            String(
                                item.name ||
                                item.title ||
                                item
                            ).trim()
                    )
                    .filter(Boolean)
            )
        ];
    }


    return String(value || "")
        .split(/[;,|]/)
        .map(item => item.trim())
        .filter(Boolean);
}


/* ================================================================
   NUMBER ARTICLES
   ================================================================ */

function numberArticles(
    articles
) {

    /*
        IMPORTANT:

        This is the permanent numbering operation.

        We NEVER number a filtered or sorted search result.

        We first sort the complete archive:

            oldest -> newest

        and only then assign:

            #1
            #2
            #3
            ...

        This prevents filters/sorting from changing article numbers.
    */

    const sorted =
        [...articles].sort(
            (a, b) => {

                const difference =
                    new Date(a.pubDate) -
                    new Date(b.pubDate);


                if (
                    difference === 0
                ) {

                    return String(
                        a.title || ""
                    ).localeCompare(
                        String(
                            b.title || ""
                        ),
                        undefined,
                        {
                            sensitivity: "base"
                        }
                    );
                }


                return difference;
            }
        );


    return sorted.map(
        (article, index) => ({

            ...article,

            articleNumber:
                index + 1

        })
    );
}


/* ================================================================
   SEARCH PARSER
   ================================================================ */

function parseSearchQuery(
    query
) {

    const tokens = [];

    const regex =
        /"([^"]+)"|(\S+)/g;

    let match;


    while (
        (match = regex.exec(query))
    ) {

        const value =
            (
                match[1] ||
                match[2] ||
                ""
            ).trim();


        if (!value) {
            continue;
        }


        if (
            value.startsWith("-") &&
            value.length > 1
        ) {

            tokens.push({

                type: "exclude",

                value:
                    normalizeText(
                        value.substring(1)
                    )

            });

        } else {

            tokens.push({

                type:
                    match[1]
                        ? "phrase"
                        : "include",

                value:
                    normalizeText(value)

            });
        }
    }


    return tokens;
}


/* ================================================================
   KEYWORD SEARCH
   ================================================================ */

function matchesKeywordSearch(
    article
) {

    const query =
        keywordInput.value.trim();


    if (!query) {
        return true;
    }


    const tokens =
        parseSearchQuery(
            query
        );


    if (
        tokens.length === 0
    ) {

        return true;
    }


    const scope =
        document.querySelector(
            'input[name="searchScope"]:checked'
        )?.value ||
        "title-content";


    const searchableText =
        scope === "title"

            ? normalizeText(
                article.title
            )

            : normalizeText(
                `${article.title} ${article.description} ${article.topics.join(" ")}`
            );


    const positive =
        tokens.filter(
            token =>
                token.type !== "exclude"
        );


    const negative =
        tokens.filter(
            token =>
                token.type === "exclude"
        );


    // Excluded terms always win.
    for (
        const token of negative
    ) {

        if (
            searchableText.includes(
                token.value
            )
        ) {

            return false;
        }
    }


    const mode =
        document.querySelector(
            'input[name="keywordMode"]:checked'
        )?.value ||
        "any";


    // Exact phrase mode.
    if (
        mode === "exact"
    ) {

        const phrase =
            positive[0]?.value || "";

        return searchableText.includes(
            phrase
        );
    }


    if (
        positive.length === 0
    ) {

        return true;
    }


    // ALL / AND.
    if (
        mode === "all"
    ) {

        return positive.every(
            token =>
                searchableText.includes(
                    token.value
                )
        );
    }


    // ANY / OR.
    return positive.some(
        token =>
            searchableText.includes(
                token.value
            )
    );
}


/* ================================================================
   DATE FILTER
   ================================================================ */

function matchesDateFilter(
    article
) {

    const date =
        new Date(
            article.pubDate
        );


    const year =
        date.getFullYear();

    const month =
        date.getMonth() + 1;


    // ------------------------------------------------------------
    // Year / month range.
    // ------------------------------------------------------------

    if (fromYear.value) {

        const startYear =
            Number(
                fromYear.value
            );

        const startMonth =
            fromMonth.value
                ? Number(fromMonth.value)
                : 1;


        if (
            year < startYear ||
            (
                year === startYear &&
                month < startMonth
            )
        ) {

            return false;
        }
    }


    if (toYear.value) {

        const endYear =
            Number(
                toYear.value
            );

        const endMonth =
            toMonth.value
                ? Number(toMonth.value)
                : 12;


        if (
            year > endYear ||
            (
                year === endYear &&
                month > endMonth
            )
        ) {

            return false;
        }
    }


    // ------------------------------------------------------------
    // Exact custom date.
    // ------------------------------------------------------------

    if (fromDate.value) {

        const start =
            new Date(
                `${fromDate.value}T00:00:00`
            );


        if (date < start) {
            return false;
        }
    }


    if (toDate.value) {

        const end =
            new Date(
                `${toDate.value}T23:59:59`
            );


        if (date > end) {
            return false;
        }
    }


    return true;
}


/* ================================================================
   READING TIME FILTER
   ================================================================ */

function matchesReadingTime(
    article
) {

    const mode =
        readingTimeFilter.value;


    if (
        mode === "all" ||
        article.readingTime === null
    ) {

        return mode === "all";
    }


    const minutes =
        article.readingTime;


    if (
        mode === "short"
    ) {

        return minutes < 5;
    }


    if (
        mode === "medium"
    ) {

        return (
            minutes >= 5 &&
            minutes <= 10
        );
    }


    if (
        mode === "long"
    ) {

        return minutes > 10;
    }


    return true;
}


/* ================================================================
   TOPIC FILTER
   ================================================================ */

function matchesTopic(
    article
) {

    const selected =
        normalizeText(
            topicFilter.value
        );


    if (!selected) {
        return true;
    }


    return article.topics.some(
        topic =>
            normalizeText(topic) ===
            selected
    );
}


/* ================================================================
   APPLY ALL FILTERS
   ================================================================ */

function applyAllFiltersAndRender() {

    if (
        numberedArticles.length === 0
    ) {

        renderEmptyState(
            "No articles are available."
        );

        return;
    }


    /*
        Start from the complete permanent archive.

        Article numbers remain untouched.
    */

    let results =
        numberedArticles.filter(
            article =>

                matchesKeywordSearch(
                    article
                ) &&

                matchesDateFilter(
                    article
                ) &&

                matchesReadingTime(
                    article
                ) &&

                matchesTopic(
                    article
                )
        );


    // ------------------------------------------------------------
    // Discovery mode.
    // ------------------------------------------------------------

    results =
        applyDiscoveryMode(
            results
        );


    // ------------------------------------------------------------
    // Explicit sort selector.
    // ------------------------------------------------------------

    results =
        applySort(
            results
        );


    // ------------------------------------------------------------
    // Apply permanent article range.
    // ------------------------------------------------------------

    results =
        results.filter(
            article =>

                article.articleNumber >=
                    currentFrom &&

                article.articleNumber <=
                    currentTo
        );


    filteredArticles =
        results;


    const totalPages =
        Math.max(
            1,
            Math.ceil(
                filteredArticles.length /
                pageSize
            )
        );


    if (
        currentPage > totalPages
    ) {

        currentPage =
            totalPages;
    }


    renderCurrentResults();

    updateNavigationButtons();

    updateRangePreview();

    savePreferences();
}


/* ================================================================
   DISCOVERY MODE
   ================================================================ */

function applyDiscoveryMode(
    articles
) {

    const mode =
        discoveryMode.value;


    const copy =
        [...articles];


    switch (mode) {

        case "newest":

            return copy.sort(
                compareNewest
            );


        case "views":

            return sortMetric(
                copy,
                "views"
            );


        case "reads":

            return sortMetric(
                copy,
                "reads"
            );


        case "comments":

            return sortMetric(
                copy,
                "comments"
            );


        case "claps":

            return sortMetric(
                copy,
                "claps"
            );


        case "oldest":
        default:

            return copy.sort(
                compareArchiveNumber
            );
    }
}


/* ================================================================
   SORT RESULTS
   ================================================================ */

function applySort(
    articles
) {

    const sort =
        sortSelector.value;


    const copy =
        [...articles];


    switch (sort) {

        case "newest":

            return copy.sort(
                compareNewest
            );


        case "oldest":

            return copy.sort(
                compareOldest
            );


        case "title-asc":

            return copy.sort(
                (a, b) =>
                    a.title.localeCompare(
                        b.title,
                        undefined,
                        {
                            sensitivity: "base"
                        }
                    )
            );


        case "title-desc":

            return copy.sort(
                (a, b) =>
                    b.title.localeCompare(
                        a.title,
                        undefined,
                        {
                            sensitivity: "base"
                        }
                    )
            );


        case "views":

            return sortMetric(
                copy,
                "views"
            );


        case "reads":

            return sortMetric(
                copy,
                "reads"
            );


        case "comments":

            return sortMetric(
                copy,
                "comments"
            );


        case "claps":

            return sortMetric(
                copy,
                "claps"
            );


        case "archive":
        default:

            return copy.sort(
                compareArchiveNumber
            );
    }
}


/* ================================================================
   SORT HELPERS
   ================================================================ */

function compareArchiveNumber(
    a,
    b
) {

    return (
        a.articleNumber -
        b.articleNumber
    );
}


function compareOldest(
    a,
    b
) {

    return (
        new Date(a.pubDate) -
        new Date(b.pubDate)
    );
}


function compareNewest(
    a,
    b
) {

    return (
        new Date(b.pubDate) -
        new Date(a.pubDate)
    );
}


function sortMetric(
    articles,
    metric
) {

    return articles.sort(
        (a, b) => {

            const aValue =
                a[metric] === null
                    ? -1
                    : a[metric];

            const bValue =
                b[metric] === null
                    ? -1
                    : b[metric];


            if (
                bValue !== aValue
            ) {

                return (
                    bValue -
                    aValue
                );
            }


            // Stable fallback.
            return (
                a.articleNumber -
                b.articleNumber
            );
        }
    );
}


/* ================================================================
   RENDER CURRENT RESULTS
   ================================================================ */

function renderCurrentResults() {

    if (
        filteredArticles.length === 0
    ) {

        renderEmptyState(
            "No articles match the current search and filters."
        );

        updateResultSummary();

        return;
    }


    const start =
        (
            currentPage - 1
        ) * pageSize;


    const end =
        start + pageSize;


    displayedArticles =
        filteredArticles.slice(
            start,
            end
        );


    renderArticleCards(
        displayedArticles
    );


    renderPagination();

    updateResultSummary();

    updateComparisonPanel();
}


/* ================================================================
   ARTICLE CARDS
   ================================================================ */

function renderArticleCards(
    articles
) {

    if (
        articles.length === 0
    ) {

        renderEmptyState(
            `No articles exist in the range ${currentFrom}–${currentTo}.`
        );

        return;
    }


    articleResults.innerHTML =
        articles
            .map(
                createArticleCard
            )
            .join("");


    applyViewClass();


    // ------------------------------------------------------------
    // Favorite buttons.
    // ------------------------------------------------------------

    articleResults
        .querySelectorAll(
            ".favorite-button"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    toggleFavorite(
                        button.dataset.articleId
                    );
                }
            );
        });


    // ------------------------------------------------------------
    // Compare buttons.
    // ------------------------------------------------------------

    articleResults
        .querySelectorAll(
            ".compare-button"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    toggleComparison(
                        Number(
                            button.dataset.articleNumber
                        )
                    );
                }
            );
        });


    // ------------------------------------------------------------
    // Similar article buttons.
    // ------------------------------------------------------------

    articleResults
        .querySelectorAll(
            ".similar-button"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    showSimilarArticles(
                        Number(
                            button.dataset.articleNumber
                        )
                    );
                }
            );
        });
}


/* ================================================================
   CREATE ARTICLE CARD
   ================================================================ */

function createArticleCard(
    article
) {

    const title =
        escapeHtml(
            article.title ||
            "Untitled Article"
        );


    const url =
        safeUrl(
            article.link
        );


    const description =
        escapeHtml(
            article.description ||
            ""
        );


    const image =
        String(
            article.image ||
            ""
        ).trim();


    const favorite =
        favorites.has(
            articleIdentity(article)
        );


    const selected =
        comparisonSelection.includes(
            article.articleNumber
        );


    const cover =
        image

            ? `
                <img
                    src="${escapeHtml(image)}"
                    alt="${title} cover image"
                    loading="lazy"
                    onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';"
                >

                <div
                    class="article-cover-placeholder"
                    style="display:none;"
                >
                    <i class="bi bi-file-earmark-text"></i>
                </div>
            `

            : `
                <div class="article-cover-placeholder">
                    <i class="bi bi-file-earmark-text"></i>
                </div>
            `;


    const topics =
        article.topics
            .slice(0, 5)
            .map(
                topic => `
                    <span class="topic-badge">
                        ${escapeHtml(topic)}
                    </span>
                `
            )
            .join("");


    const metrics = [];


    if (
        article.readingTime !== null
    ) {

        metrics.push(
            `<span class="article-meta-badge">
                <i class="bi bi-hourglass"></i>
                ${formatNumber(article.readingTime)} min read
            </span>`
        );
    }


    if (
        article.views !== null
    ) {

        metrics.push(
            `<span class="article-meta-badge">
                <i class="bi bi-eye"></i>
                ${formatCompactNumber(article.views)} views
            </span>`
        );
    }


    if (
        article.reads !== null
    ) {

        metrics.push(
            `<span class="article-meta-badge">
                <i class="bi bi-book"></i>
                ${formatCompactNumber(article.reads)} reads
            </span>`
        );
    }


    if (
        article.comments !== null
    ) {

        metrics.push(
            `<span class="article-meta-badge">
                <i class="bi bi-chat"></i>
                ${formatCompactNumber(article.comments)} comments
            </span>`
        );
    }


    if (
        article.claps !== null
    ) {

        metrics.push(
            `<span class="article-meta-badge">
                <i class="bi bi-hand-thumbs-up"></i>
                ${formatCompactNumber(article.claps)} claps
            </span>`
        );
    }


    return `
        <div class="col">

            <article class="article-card">

                <div class="article-cover">

                    ${cover}

                    <span class="article-number-badge">
                        #${article.articleNumber}
                    </span>

                    <button
                        type="button"
                        class="favorite-button ${favorite ? "active" : ""}"
                        data-article-id="${escapeHtml(articleIdentity(article))}"
                        title="${favorite ? "Remove favorite" : "Add favorite"}"
                        aria-label="${favorite ? "Remove favorite" : "Add favorite"}"
                    >
                        <i class="bi ${favorite ? "bi-star-fill" : "bi-star"}"></i>
                    </button>

                </div>


                <div class="article-body">

                    <h3 class="article-title">

                        <a
                            href="${url}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            ${title}
                        </a>

                    </h3>


                    <div class="article-date">

                        <i class="bi bi-calendar3"></i>

                        Published:
                        ${formatDate(article.pubDate)}

                    </div>


                    ${
                        description

                            ? `
                                <div class="article-description">
                                    ${description}
                                </div>
                            `

                            : ""
                    }


                    ${
                        metrics.length

                            ? `
                                <div class="article-meta">
                                    ${metrics.join("")}
                                </div>
                            `

                            : ""
                    }


                    ${
                        topics

                            ? `
                                <div class="article-topics">
                                    ${topics}
                                </div>
                            `

                            : ""
                    }


                    <div class="article-footer">

                        <a
                            href="${url}"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="btn btn-dark article-open-button"
                        >
                            <i class="bi bi-box-arrow-up-right"></i>
                            Open Article
                        </a>


                        <button
                            type="button"
                            class="btn btn-outline-primary compare-button ${selected ? "selected" : ""}"
                            data-article-number="${article.articleNumber}"
                            title="Compare article"
                        >
                            <i class="bi bi-layout-split"></i>
                        </button>


                        <button
                            type="button"
                            class="btn btn-outline-secondary compare-button similar-button"
                            data-article-number="${article.articleNumber}"
                            title="Find similar articles"
                        >
                            <i class="bi bi-stars"></i>
                        </button>

                    </div>

                </div>

            </article>

        </div>
    `;
}


/* ================================================================
   ARTICLE IDENTITY
   ================================================================ */

function articleIdentity(
    article
) {

    return (
        article.link ||
        `${article.articleNumber}:${article.title}`
    );
}


/* ================================================================
   FAVORITES
   ================================================================ */

function toggleFavorite(
    id
) {

    if (
        favorites.has(id)
    ) {

        favorites.delete(id);

    } else {

        favorites.add(id);
    }


    saveFavorites();

    renderCurrentResults();
}


/* ================================================================
   COMPARISON
   ================================================================ */

function toggleComparison(
    articleNumber
) {

    const index =
        comparisonSelection.indexOf(
            articleNumber
        );


    if (index >= 0) {

        comparisonSelection.splice(
            index,
            1
        );

    } else {

        if (
            comparisonSelection.length >= 3
        ) {

            showStatus(
                "You can compare a maximum of three articles.",
                "warning"
            );

            return;
        }


        comparisonSelection.push(
            articleNumber
        );
    }


    renderCurrentResults();

    updateComparisonPanel();
}


/* ================================================================
   COMPARISON PANEL
   ================================================================ */

function updateComparisonPanel() {

    if (
        comparisonSelection.length === 0
    ) {

        comparisonSection.hidden = true;

        return;
    }


    const selectedArticles =
        comparisonSelection
            .map(
                number =>
                    numberedArticles.find(
                        article =>
                            article.articleNumber === number
                    )
            )
            .filter(Boolean);


    comparisonSection.hidden = false;


    comparisonContent.innerHTML = `

        <div class="comparison-table">

            <table>

                <thead>

                    <tr>

                        <th>
                            Feature
                        </th>

                        ${selectedArticles
                            .map(
                                article =>
                                    `
                                    <th>
                                        #${article.articleNumber}
                                        <br>
                                        ${escapeHtml(article.title)}
                                    </th>
                                    `
                            )
                            .join("")}

                    </tr>

                </thead>


                <tbody>

                    ${comparisonRow(
                        "Publication Date",
                        selectedArticles,
                        article =>
                            formatDate(
                                article.pubDate
                            )
                    )}

                    ${comparisonRow(
                        "Topics",
                        selectedArticles,
                        article =>
                            article.topics.join(", ") ||
                            "Not available"
                    )}

                    ${comparisonRow(
                        "Reading Time",
                        selectedArticles,
                        article =>
                            article.readingTime !== null
                                ? `${article.readingTime} min`
                                : "Not available"
                    )}

                    ${comparisonRow(
                        "Views",
                        selectedArticles,
                        article =>
                            article.views !== null
                                ? formatCompactNumber(article.views)
                                : "Not available"
                    )}

                    ${comparisonRow(
                        "Reads",
                        selectedArticles,
                        article =>
                            article.reads !== null
                                ? formatCompactNumber(article.reads)
                                : "Not available"
                    )}

                    ${comparisonRow(
                        "Comments",
                        selectedArticles,
                        article =>
                            article.comments !== null
                                ? formatCompactNumber(article.comments)
                                : "Not available"
                    )}

                    ${comparisonRow(
                        "Claps",
                        selectedArticles,
                        article =>
                            article.claps !== null
                                ? formatCompactNumber(article.claps)
                                : "Not available"
                    )}

                    ${comparisonRow(
                        "Article Number",
                        selectedArticles,
                        article =>
                            `#${article.articleNumber}`
                    )}

                </tbody>

            </table>

        </div>

    `;
}


/* ================================================================
   COMPARISON ROW
   ================================================================ */

function comparisonRow(
    label,
    articles,
    getter
) {

    return `

        <tr>

            <th>
                ${escapeHtml(label)}
            </th>

            ${articles
                .map(
                    article =>
                        `
                        <td>
                            ${escapeHtml(
                                String(
                                    getter(article)
                                )
                            )}
                        </td>
                        `
                )
                .join("")}

        </tr>

    `;
}


/* ================================================================
   SIMILAR ARTICLES
   ================================================================ */

function showSimilarArticles(
    articleNumber
) {

    const source =
        numberedArticles.find(
            article =>
                article.articleNumber ===
                articleNumber
        );


    if (!source) {
        return;
    }


    const sourceWords =
        new Set(
            [
                ...source.topics,
                ...source.title.split(/\s+/)
            ]
                .map(
                    normalizeText
                )
                .filter(
                    word =>
                        word.length >= 3
                )
        );


    const similar =
        numberedArticles
            .filter(
                article =>
                    article.articleNumber !==
                    source.articleNumber
            )
            .map(
                article => {

                    const candidateWords =
                        new Set(
                            [
                                ...article.topics,
                                ...article.title.split(/\s+/)
                            ]
                                .map(
                                    normalizeText
                                )
                                .filter(
                                    word =>
                                        word.length >= 3
                                )
                        );


                    let score = 0;


                    sourceWords.forEach(
                        word => {

                            if (
                                candidateWords.has(
                                    word
                                )
                            ) {

                                score++;
                            }
                        }
                    );


                    return {
                        article,
                        score
                    };
                }
            )
            .filter(
                item =>
                    item.score > 0
            )
            .sort(
                (a, b) =>
                    b.score - a.score
            )
            .slice(0, 10);


    if (
        similar.length === 0
    ) {

        showStatus(
            "No strongly similar articles were found.",
            "info"
        );

        return;
    }


    filteredArticles =
        similar.map(
            item =>
                item.article
        );


    currentPage = 1;


    resultSummary.textContent =
        `Showing articles similar to #${source.articleNumber}: ${source.title}`;


    renderCurrentResults();

    scrollToResults();
}


/* ================================================================
   STATISTICS
   ================================================================ */

function renderStatistics() {

    const articleCount =
        numberedArticles.length;


    const years =
        [
            ...new Set(
                numberedArticles.map(
                    article =>
                        new Date(
                            article.pubDate
                        ).getFullYear()
                )
            )
        ];


    const topicSet =
        new Set();


    numberedArticles.forEach(
        article => {

            article.topics.forEach(
                topic =>
                    topicSet.add(
                        normalizeText(topic)
                    )
            );
        }
    );


    const yearCounts = {};


    numberedArticles.forEach(
        article => {

            const year =
                new Date(
                    article.pubDate
                ).getFullYear();

            yearCounts[year] =
                (
                    yearCounts[year] || 0
                ) + 1;
        }
    );


    const mostActiveYear =
        Object.entries(
            yearCounts
        )
            .sort(
                (a, b) =>
                    b[1] - a[1]
            )[0];


    document.getElementById(
        "statArticleCount"
    ).textContent =
        articleCount;


    document.getElementById(
        "statYearsActive"
    ).textContent =
        years.length;


    document.getElementById(
        "statTopicCount"
    ).textContent =
        topicSet.size;


    document.getElementById(
        "statActiveYear"
    ).textContent =
        mostActiveYear
            ? mostActiveYear[0]
            : "—";


    renderTimeline(
        yearCounts
    );
}


/* ================================================================
   PUBLICATION TIMELINE
   ================================================================ */

function renderTimeline(
    yearCounts
) {

    const container =
        document.getElementById(
            "publicationTimeline"
        );


    const entries =
        Object.entries(
            yearCounts
        )
            .sort(
                (a, b) =>
                    Number(a[0]) -
                    Number(b[0])
            );


    if (
        entries.length === 0
    ) {

        container.innerHTML =
            `
            <div class="timeline-empty">
                No publication data available.
            </div>
            `;

        return;
    }


    const maximum =
        Math.max(
            ...entries.map(
                entry =>
                    entry[1]
            )
        );


    container.innerHTML =
        entries
            .map(
                ([year, count]) => {

                    const percentage =
                        Math.max(
                            5,
                            Math.round(
                                (
                                    count /
                                    maximum
                                ) * 100
                            )
                        );


                    return `
                        <div class="timeline-row">

                            <div class="timeline-year">
                                ${year}
                            </div>

                            <div class="timeline-bar">
                                <span
                                    style="width:${percentage}%"
                                ></span>
                            </div>

                            <div class="timeline-count">
                                ${count}
                                ${count === 1 ? "article" : "articles"}
                            </div>

                        </div>
                    `;
                }
            )
            .join("");
}


/* ================================================================
   YEAR OPTIONS
   ================================================================ */

function populateYearOptions() {

    const years =
        [
            ...new Set(
                numberedArticles.map(
                    article =>
                        new Date(
                            article.pubDate
                        ).getFullYear()
                )
            )
        ]
        .sort(
            (a, b) =>
                a - b
        );


    const previousFrom =
        fromYear.value;

    const previousTo =
        toYear.value;


    fromYear.innerHTML =
        `<option value="">All Years</option>`;


    toYear.innerHTML =
        `<option value="">All Years</option>`;


    years.forEach(
        year => {

            const fromOption =
                document.createElement(
                    "option"
                );

            fromOption.value =
                year;

            fromOption.textContent =
                year;


            const toOption =
                document.createElement(
                    "option"
                );

            toOption.value =
                year;

            toOption.textContent =
                year;


            fromYear.appendChild(
                fromOption
            );

            toYear.appendChild(
                toOption
            );
        }
    );


    fromYear.value =
        previousFrom;

    toYear.value =
        previousTo;
}


/* ================================================================
   MONTH OPTIONS
   ================================================================ */

function populateMonthOptions() {

    const months = [

        [1, "January"],
        [2, "February"],
        [3, "March"],
        [4, "April"],
        [5, "May"],
        [6, "June"],
        [7, "July"],
        [8, "August"],
        [9, "September"],
        [10, "October"],
        [11, "November"],
        [12, "December"]

    ];


    [
        fromMonth,
        toMonth
    ].forEach(select => {

        select.innerHTML =
            `<option value="">All Months</option>`;


        months.forEach(
            ([value, label]) => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    value;

                option.textContent =
                    label;

                select.appendChild(
                    option
                );
            }
        );
    });
}


/* ================================================================
   TOPIC OPTIONS
   ================================================================ */

function populateTopicOptions() {

    const topics =
        new Map();


    numberedArticles.forEach(
        article => {

            article.topics.forEach(
                topic => {

                    const key =
                        normalizeText(
                            topic
                        );


                    if (
                        key &&
                        !topics.has(key)
                    ) {

                        topics.set(
                            key,
                            topic
                        );
                    }
                }
            );
        }
    );


    const current =
        topicFilter.value;


    topicFilter.innerHTML =
        `<option value="">All Topics</option>`;


    [...topics.entries()]
        .sort(
            (a, b) =>
                a[1].localeCompare(
                    b[1]
                )
        )
        .forEach(
            ([value, label]) => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    value;

                option.textContent =
                    label;

                topicFilter.appendChild(
                    option
                );
            }
        );


    topicFilter.value =
        current;
}


/* ================================================================
   RANGE
   ================================================================ */

function setRange(
    from,
    to
) {

    let safeFrom =
        parseInt(
            from,
            10
        );

    let safeTo =
        parseInt(
            to,
            10
        );


    if (
        !Number.isFinite(safeFrom) ||
        safeFrom < 1
    ) {

        safeFrom = 1;
    }


    if (
        !Number.isFinite(safeTo) ||
        safeTo < safeFrom
    ) {

        safeTo =
            safeFrom + 9;
    }


    currentFrom =
        safeFrom;

    currentTo =
        safeTo;


    fromArticleInput.value =
        currentFrom;

    toArticleInput.value =
        currentTo;


    currentPage = 1;


    updateRangePreview();

    updateQuickRangeState();

    updateNavigationButtons();

    savePreferences();
}


/* ================================================================
   RANGE INPUT
   ================================================================ */

function handleRangeInputChange() {

    let from =
        parseInt(
            fromArticleInput.value,
            10
        );

    let to =
        parseInt(
            toArticleInput.value,
            10
        );


    if (
        !Number.isFinite(from) ||
        from < 1
    ) {

        from = 1;
    }


    if (
        !Number.isFinite(to) ||
        to < from
    ) {

        to = from;
    }


    currentFrom =
        from;

    currentTo =
        to;


    currentPage = 1;


    updateRangePreview();

    updateQuickRangeState();

    updateNavigationButtons();


    if (
        numberedArticles.length > 0
    ) {

        applyAllFiltersAndRender();
    }
}


/* ================================================================
   RANGE VALIDATION
   ================================================================ */

function validateRange() {

    const from =
        parseInt(
            fromArticleInput.value,
            10
        );

    const to =
        parseInt(
            toArticleInput.value,
            10
        );


    if (
        !Number.isFinite(from) ||
        from < 1
    ) {

        showStatus(
            "The starting article number must be 1 or greater.",
            "warning"
        );

        return false;
    }


    if (
        !Number.isFinite(to) ||
        to < 1
    ) {

        showStatus(
            "The ending article number must be 1 or greater.",
            "warning"
        );

        return false;
    }


    if (
        to < from
    ) {

        showStatus(
            "The ending article number must be greater than or equal to the starting article number.",
            "warning"
        );

        return false;
    }


    currentFrom =
        from;

    currentTo =
        to;


    return true;
}


/* ================================================================
   ADJUST RANGE
   ================================================================ */

function adjustRangeToAvailableArticles() {

    const total =
        numberedArticles.length;


    if (
        total === 0
    ) {

        return;
    }


    if (
        currentFrom > total
    ) {

        currentFrom =
            Math.max(
                1,
                total -
                CONFIG.navigationStep +
                1
            );
    }


    if (
        currentTo > total
    ) {

        currentTo =
            total;
    }


    if (
        currentTo < currentFrom
    ) {

        currentTo =
            currentFrom;
    }


    fromArticleInput.value =
        currentFrom;

    toArticleInput.value =
        currentTo;


    updateRangePreview();
}


/* ================================================================
   PREVIOUS RANGE
   ================================================================ */

function showPreviousRange() {

    if (
        numberedArticles.length === 0
    ) {

        return;
    }


    const rangeLength =
        currentTo -
        currentFrom +
        1;


    let newFrom =
        Math.max(
            1,
            currentFrom -
            rangeLength
        );


    let newTo =
        newFrom +
        rangeLength -
        1;


    if (
        newTo >
        numberedArticles.length
    ) {

        newTo =
            numberedArticles.length;

        newFrom =
            Math.max(
                1,
                newTo -
                rangeLength +
                1
            );
    }


    setRange(
        newFrom,
        newTo
    );


    applyAllFiltersAndRender();

    scrollToResults();
}


/* ================================================================
   NEXT RANGE
   ================================================================ */

function showNextRange() {

    if (
        numberedArticles.length === 0
    ) {

        return;
    }


    const rangeLength =
        currentTo -
        currentFrom +
        1;


    const newFrom =
        currentFrom +
        rangeLength;


    if (
        newFrom >
        numberedArticles.length
    ) {

        return;
    }


    const newTo =
        Math.min(
            numberedArticles.length,
            newFrom +
            rangeLength -
            1
        );


    setRange(
        newFrom,
        newTo
    );


    applyAllFiltersAndRender();

    scrollToResults();
}


/* ================================================================
   RANGE PREVIEW
   ================================================================ */

function updateRangePreview() {

    rangePreviewText.textContent =
        `Articles ${currentFrom}–${currentTo}`;

    selectedRangeLabel.textContent =
        `${currentFrom}–${currentTo}`;

    currentRangeText.textContent =
        `${currentFrom}–${currentTo}`;
}


/* ================================================================
   QUICK RANGE STATE
   ================================================================ */

function updateQuickRangeState() {

    quickRangeButtons.forEach(
        button => {

            let from =
                button.dataset.from;

            let to =
                button.dataset.to;


            if (
                from === "last"
            ) {

                button.classList.toggle(
                    "active",
                    numberedArticles.length > 0 &&
                    currentTo ===
                        numberedArticles.length &&
                    currentFrom ===
                        Math.max(
                            1,
                            numberedArticles.length - 9
                        )
                );

                return;
            }


            button.classList.toggle(
                "active",
                Number(from) === currentFrom &&
                Number(to) === currentTo
            );
        }
    );
}


/* ================================================================
   NAVIGATION BUTTONS
   ================================================================ */

function updateNavigationButtons() {

    const total =
        numberedArticles.length;


    previousRangeBtn.disabled =
        total === 0 ||
        currentFrom <= 1;


    nextRangeBtn.disabled =
        total === 0 ||
        currentTo >= total;
}


/* ================================================================
   PAGINATION
   ================================================================ */

function renderPagination() {

    paginationControls.innerHTML = "";


    const totalPages =
        Math.ceil(
            filteredArticles.length /
            pageSize
        );


    if (
        totalPages <= 1
    ) {

        return;
    }


    const maxButtons = 7;


    let start =
        Math.max(
            1,
            currentPage - 3
        );


    let end =
        Math.min(
            totalPages,
            start + maxButtons - 1
        );


    if (
        end - start <
        maxButtons - 1
    ) {

        start =
            Math.max(
                1,
                end - maxButtons + 1
            );
    }


    // Previous.
    paginationControls.appendChild(
        createPageButton(
            "‹",
            currentPage - 1,
            currentPage === 1
        )
    );


    for (
        let page = start;
        page <= end;
        page++
    ) {

        paginationControls.appendChild(
            createPageButton(
                page,
                page,
                false,
                page === currentPage
            )
        );
    }


    // Next.
    paginationControls.appendChild(
        createPageButton(
            "›",
            currentPage + 1,
            currentPage === totalPages
        )
    );
}


/* ================================================================
   CREATE PAGE BUTTON
   ================================================================ */

function createPageButton(
    label,
    page,
    disabled = false,
    active = false
) {

    const button =
        document.createElement(
            "button"
        );


    button.type =
        "button";

    button.className =
        `btn btn-sm ${
            active
                ? "btn-primary"
                : "btn-outline-secondary"
        }`;

    button.textContent =
        label;

    button.disabled =
        disabled;


    button.addEventListener(
        "click",
        () => {

            currentPage =
                page;

            renderCurrentResults();

            scrollToResults();
        }
    );


    return button;
}


/* ================================================================
   RESULT SUMMARY
   ================================================================ */

function updateResultSummary() {

    const total =
        numberedArticles.length;

    const filtered =
        filteredArticles.length;


    visibleArticleCount.textContent =
        Math.min(
            displayedArticles.length,
            filtered
        );


    if (
        total === 0
    ) {

        resultSummary.textContent =
            "No articles are available.";

        return;
    }


    if (
        filtered === 0
    ) {

        resultSummary.textContent =
            "No articles found matching the current filters.";

        return;
    }


    const start =
        (
            currentPage - 1
        ) * pageSize + 1;


    const end =
        Math.min(
            currentPage * pageSize,
            filtered
        );


    const keywordText =
        keywordInput.value.trim();


    resultSummary.textContent =
        keywordText

            ? `Showing ${start}–${end} of ${filtered} matching articles from ${total} archived articles.`

            : `Showing ${start}–${end} of ${filtered} articles from ${total} archived articles.`;
}


/* ================================================================
   VIEW MODE
   ================================================================ */

function setView(
    view
) {

    currentView =
        view === "list"
            ? "list"
            : "grid";


    gridViewButton.classList.toggle(
        "active",
        currentView === "grid"
    );

    listViewButton.classList.toggle(
        "active",
        currentView === "list"
    );


    applyViewClass();

    savePreferences();
}


function applyViewClass() {

    if (!articleResults) {
        return;
    }


    articleResults.classList.toggle(
        "list-view",
        currentView === "list"
    );
}


/* ================================================================
   DATE FORMATTING
   ================================================================ */

function formatDate(
    dateValue
) {

    const date =
        new Date(
            dateValue
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "Date unavailable";
    }


    return date.toLocaleDateString(
        undefined,
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}


/* ================================================================
   NUMBER FORMATTING
   ================================================================ */

function formatNumber(
    value
) {

    return Number(
        value
    ).toLocaleString(
        undefined,
        {
            maximumFractionDigits: 1
        }
    );
}


function formatCompactNumber(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "N/A";
    }


    return Intl.NumberFormat(
        undefined,
        {
            notation: "compact",
            maximumFractionDigits: 1
        }
    ).format(
        Number(value)
    );
}


/* ================================================================
   STRIP HTML
   ================================================================ */

function stripHtml(
    html
) {

    const element =
        document.createElement(
            "div"
        );


    element.innerHTML =
        html || "";


    return (
        element.textContent ||
        element.innerText ||
        ""
    )
        .replace(
            /\s+/g,
            " "
        )
        .trim();
}


/* ================================================================
   EXTRACT COVER IMAGE
   ================================================================ */

function extractImageFromHtml(
    html
) {

    if (!html) {
        return "";
    }


    const container =
        document.createElement(
            "div"
        );


    container.innerHTML =
        html;


    const images =
        container.querySelectorAll(
            "img"
        );


    for (
        const image of images
    ) {

        const src =
            image.getAttribute(
                "src"
            ) ||
            image.getAttribute(
                "data-src"
            ) ||
            "";


        if (!src) {
            continue;
        }


        const width =
            parseInt(
                image.getAttribute(
                    "width"
                ),
                10
            );


        const height =
            parseInt(
                image.getAttribute(
                    "height"
                ),
                10
            );


        const isTrackingPixel =
            (
                Number.isFinite(width) &&
                width <= 2
            ) ||
            (
                Number.isFinite(height) &&
                height <= 2
            ) ||
            src.includes(
                "stat.medium.com"
            ) ||
            src.includes(
                "/stat?event="
            );


        if (
            isTrackingPixel
        ) {

            continue;
        }


        return src;
    }


    return "";
}


/* ================================================================
   LOADING STATE
   ================================================================ */

function setLoadingState(
    loading
) {

    loadArticlesBtn.disabled =
        loading;


    if (loading) {

        loadArticlesBtn.innerHTML = `
            <span
                class="spinner-border spinner-border-sm me-2"
                aria-hidden="true"
            ></span>
            Loading Articles...
        `;


        articleResults.innerHTML = `
            <div class="col-12">

                <div class="loading-state">

                    <div
                        class="spinner-border text-primary mb-3"
                        role="status"
                        aria-label="Loading"
                    ></div>

                    <h3>
                        Loading Article Archive
                    </h3>

                    <p>
                        Preparing chronological article data...
                    </p>

                </div>

            </div>
        `;

    } else {

        loadArticlesBtn.innerHTML = `
            <i class="bi bi-search"></i>
            Show Articles
        `;
    }
}


/* ================================================================
   STATUS
   ================================================================ */

function showStatus(
    message,
    type
) {

    statusBox.className =
        `alert alert-${type} status-box`;

    statusBox.textContent =
        message;

    statusBox.style.display =
        "block";
}


/* ================================================================
   EMPTY STATE
   ================================================================ */

function renderEmptyState(
    message
) {

    articleResults.innerHTML = `

        <div class="col-12">

            <div class="empty-state">

                <div class="empty-state-icon">
                    <i class="bi bi-search"></i>
                </div>

                <h3>
                    No Articles Found
                </h3>

                <p>
                    ${escapeHtml(message)}
                </p>

            </div>

        </div>

    `;


    visibleArticleCount.textContent =
        "0";


    displayedArticles = [];

    renderPagination();
}


/* ================================================================
   ERROR STATE
   ================================================================ */

function renderErrorState(
    message
) {

    articleResults.innerHTML = `

        <div class="col-12">

            <div class="empty-state">

                <div class="empty-state-icon">
                    <i class="bi bi-exclamation-triangle"></i>
                </div>

                <h3>
                    Article Loading Failed
                </h3>

                <p>
                    ${escapeHtml(message)}
                </p>

            </div>

        </div>

    `;


    visibleArticleCount.textContent =
        "0";

    displayedArticles = [];
}


/* ================================================================
   RESET APPLICATION
   ================================================================ */

function resetApplication() {

    profileUrlInput.value =
        "";

    discoveryMode.value =
        "oldest";

    keywordInput.value =
        "";

    sortSelector.value =
        "archive";

    fromYear.value =
        "";

    fromMonth.value =
        "";

    toYear.value =
        "";

    toMonth.value =
        "";

    fromDate.value =
        "";

    toDate.value =
        "";

    readingTimeFilter.value =
        "all";

    topicFilter.value =
        "";


    fromArticleInput.value =
        "1";

    toArticleInput.value =
        "10";


    currentFrom =
        1;

    currentTo =
        10;

    currentPage =
        1;


    allArticles = [];

    numberedArticles = [];

    filteredArticles = [];

    displayedArticles = [];

    comparisonSelection = [];


    updateRangePreview();

    updateQuickRangeState();

    updateNavigationButtons();


    selectedRangeLabel.textContent =
        "1–10";

    currentRangeText.textContent =
        "1–10";

    visibleArticleCount.textContent =
        "0";

    resultSummary.textContent =
        "Enter a Medium profile to begin.";


    statusBox.style.display =
        "none";


    comparisonSection.hidden =
        true;


    articleResults.innerHTML = `

        <div class="col-12">

            <div class="empty-state">

                <div class="empty-state-icon">
                    <i class="bi bi-collection"></i>
                </div>

                <h3>
                    Ready to Explore
                </h3>

                <p>
                    Enter a Medium profile above and load the archive.
                </p>

            </div>

        </div>

    `;


    savePreferences();
}


/* ================================================================
   DARK MODE
   ================================================================ */

function toggleTheme() {

    document.body.classList.toggle(
        "dark-mode"
    );


    const dark =
        document.body.classList.contains(
            "dark-mode"
        );


    localStorage.setItem(
        `${CONFIG.storagePrefix}Theme`,
        dark
            ? "dark"
            : "light"
    );


    updateThemeButton(
        dark
    );
}


/* ================================================================
   THEME BUTTON
   ================================================================ */

function updateThemeButton(
    dark
) {

    themeButton.innerHTML =
        dark

            ? '<i class="bi bi-sun"></i>'

            : '<i class="bi bi-moon-stars"></i>';


    themeButton.title =
        dark

            ? "Switch to light mode"

            : "Switch to dark mode";
}


/* ================================================================
   SCROLL
   ================================================================ */

function scrollToResults() {

    const section =
        document.querySelector(
            ".results-section"
        );


    if (!section) {
        return;
    }


    section.scrollIntoView(
        {
            behavior: "smooth",
            block: "start"
        }
    );
}


/* ================================================================
   END OF APPLICATION
   ================================================================ */
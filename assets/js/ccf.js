(function () {
    var path = window.location.pathname || '';
    var base = path.replace(/\/[^/]*$/, '/');
    if (!base.endsWith('/')) base += '/';
    window.CCF_JSON_PATH = base + 'ccf_collect.json';
})();

let allItems = [];
let currentField = '';
let currentType = '';
let currentRating = '';

function updateSectionStats() {
    var total = allItems.length;
    var journal = allItems.filter(function (item) { return item.type === 'journal'; }).length;
    var conference = allItems.filter(function (item) { return item.type === 'conference'; }).length;
    var el = document.getElementById('section-stats');
    if (el) {
        el.style.display = 'block';
        document.getElementById('total-n').textContent = total;
        document.getElementById('journal-n').textContent = journal;
        document.getElementById('conference-n').textContent = conference;
    }
}

function getUniqueValues(key) {
    var set = new Set();
    allItems.forEach(function (item) {
        var v = item[key];
        if (v != null && v !== '') set.add(String(v));
    });
    return Array.from(set).sort(function (a, b) { return a.localeCompare(b, 'zh-CN'); });
}

/** 领域顺序：人工智能排最前，其余按中文排序 */
function getFieldOrder() {
    var fields = getUniqueValues('field');
    var idx = fields.indexOf('人工智能');
    if (idx !== -1) {
        fields.splice(idx, 1);
        fields.unshift('人工智能');
    }
    return fields;
}

/** 类型顺序：会议在期刊前 */
function getTypeOrder() {
    var types = getUniqueValues('type');
    if (types.indexOf('conference') !== -1 && types.indexOf('journal') !== -1)
        return ['conference', 'journal'];
    return types;
}

function createFilterButtons(containerId, values, currentValue, labelAll, onSelect) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    var allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'filter-btn' + (currentValue === '' ? ' active' : '');
    allBtn.textContent = labelAll;
    allBtn.dataset.value = '';
    allBtn.addEventListener('click', function () { onSelect(''); });
    container.appendChild(allBtn);

    values.forEach(function (v) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'filter-btn' + (currentValue === v ? ' active' : '');
        btn.textContent = v;
        btn.dataset.value = v;
        btn.addEventListener('click', function () { onSelect(v); });
        container.appendChild(btn);
    });
}

function setActiveButton(containerId, value) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.filter-btn').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.value === value);
    });
}

function isWordChar(c) {
    return /\w/.test(c) || /[\u4e00-\u9fa5]/.test(c);
}

function textContains(text, search, wholeWord, caseSensitive) {
    if (!search) return true;
    var s = caseSensitive ? String(text) : String(text).toLowerCase();
    var q = caseSensitive ? search : search.toLowerCase();
    var idx = s.indexOf(q);
    while (idx !== -1) {
        if (wholeWord) {
            var beforeOk = idx === 0 || !isWordChar(String(text).charAt(idx - 1));
            var afterOk = idx + q.length >= text.length || !isWordChar(String(text).charAt(idx + q.length));
            if (beforeOk && afterOk) return true;
        } else {
            return true;
        }
        idx = s.indexOf(q, idx + 1);
    }
    return false;
}

function applyFilters() {
    var searchInput = document.getElementById('search-input').value.trim();
    var wholeWordBtn = document.getElementById('search-whole-word');
    var caseBtn = document.getElementById('search-case');
    var wholeWord = wholeWordBtn && wholeWordBtn.classList.contains('active');
    var caseSensitive = caseBtn && caseBtn.classList.contains('active');
    var list = allItems.filter(function (item) {
        if (currentField && item.field !== currentField) return false;
        if (currentType && item.type !== currentType) return false;
        if (currentRating && item.Rating !== currentRating) return false;
        if (searchInput) {
            var abbr = item.Abbreviation || '';
            var full = item['Full-Name'] || '';
            if (!textContains(abbr, searchInput, wholeWord, caseSensitive) && !textContains(full, searchInput, wholeWord, caseSensitive)) return false;
        }
        return true;
    });
    var isDefaultView = !currentField && !currentType && !currentRating && !searchInput;
    var fieldOrder = getFieldOrder();
    var typeOrder = getTypeOrder();
    if (list.length > 0) {
        if (isDefaultView) {
            var ratingOrder = { 'A': 0, 'B': 1, 'C': 2 };
            function ratingRank(r) {
                var raw = (r || '').toString().trim().replace(/类$/, '').toUpperCase().charAt(0);
                return ratingOrder[raw] !== undefined ? ratingOrder[raw] : 3;
            }
            list.sort(function (a, b) {
                var ra = ratingRank(a.Rating);
                var rb = ratingRank(b.Rating);
                if (ra !== rb) return ra - rb;
                var fa = fieldOrder.indexOf(a.field);
                var fb = fieldOrder.indexOf(b.field);
                if (fa !== fb) return fa - fb;
                var ta = typeOrder.indexOf(a.type);
                var tb = typeOrder.indexOf(b.type);
                if (ta !== tb) return ta - tb;
                return (a['Full-Name'] || '').localeCompare(b['Full-Name'] || '', 'zh-CN');
            });
        } else {
            list.sort(function (a, b) {
                var fa = fieldOrder.indexOf(a.field);
                var fb = fieldOrder.indexOf(b.field);
                if (fa !== fb) return fa - fb;
                var ta = typeOrder.indexOf(a.type);
                var tb = typeOrder.indexOf(b.type);
                if (ta !== tb) return ta - tb;
                return (a['Full-Name'] || '').localeCompare(b['Full-Name'] || '', 'zh-CN');
            });
        }
    }
    renderCards(list, list.length > 0, searchInput, caseSensitive);
    document.getElementById('result-n').textContent = list.length;
}

function renderCards(list, showGroupByField, searchHighlight, searchCaseSensitive) {
    var container = document.getElementById('cards-container');
    container.innerHTML = '';

    if (list.length === 0) {
        container.innerHTML = '<p class="no-results">暂无匹配项</p>';
        return;
    }

    var search = (searchHighlight && searchHighlight.length > 0) ? searchHighlight : '';
    var caseSensitive = !!searchCaseSensitive;
    if (showGroupByField) {
        var lastField = null;
        var lastType = null;
        list.forEach(function (item) {
            var typeLabel = item.type === 'journal' ? '期刊' : '会议';
            if (item.field !== lastField) {
                lastField = item.field;
                lastType = null;
                var titleDiv = document.createElement('div');
                titleDiv.className = 'ccf-field-title';
                titleDiv.textContent = item.field || '—';
                container.appendChild(titleDiv);
            }
            if (item.type !== lastType) {
                lastType = item.type;
                var typeDiv = document.createElement('div');
                typeDiv.className = 'ccf-type-divider';
                typeDiv.innerHTML =
                    '<span class="ccf-type-divider-line"></span>' +
                    '<span class="ccf-type-divider-label">' + typeLabel + '</span>' +
                    '<span class="ccf-type-divider-line"></span>';
                container.appendChild(typeDiv);
            }
            container.appendChild(buildCard(item, search, caseSensitive));
        });
    } else {
        list.forEach(function (item) {
            container.appendChild(buildCard(item, search, caseSensitive));
        });
    }
}

function highlightMatch(text, search, caseSensitive) {
    if (!search || !text) return escapeHtml(text);
    var s = String(text);
    var q = String(search);
    var lower = caseSensitive ? s : s.toLowerCase();
    var qLower = caseSensitive ? q : q.toLowerCase();
    var result = '';
    var i = 0;
    while (i < s.length) {
        var idx = lower.indexOf(qLower, i);
        if (idx === -1) {
            result += escapeHtml(s.substring(i));
            break;
        }
        result += escapeHtml(s.substring(i, idx)) +
            '<span class="ccf-search-highlight">' + escapeHtml(s.substring(idx, idx + q.length)) + '</span>';
        i = idx + q.length;
    }
    return result;
}

function buildCard(item, searchHighlight, searchCaseSensitive) {
    var card = document.createElement('div');
    card.className = 'ccf-card';

    var abbr = item.Abbreviation && item.Abbreviation !== '-' ? item.Abbreviation : '—';
    var fullName = item['Full-Name'] || '—';
    var ratingRaw = (item.Rating || '').toString().trim();
    var rating = ratingRaw.replace(/类$/, '').toUpperCase().charAt(0) || '';
    var ratingClass = (rating === 'A' || rating === 'B' || rating === 'C') ? ' ccf-rating-' + rating.toLowerCase() : '';
    var ratingDisplay = (rating === 'A' || rating === 'B' || rating === 'C') ? rating : (item.Rating ? escapeHtml(String(item.Rating)) : '—');
    var typeLabel = item.type === 'journal' ? '期刊' : '会议';
    var field = item.field || '—';
    var publisher = item.Publisher && item.Publisher !== '-' ? item.Publisher : '—';
    var website = item.Website || '#';

    var caseSensitive = !!searchCaseSensitive;
    var hl = searchHighlight ? function (t) { return highlightMatch(t, searchHighlight, caseSensitive); } : escapeHtml;

    var typeClass = item.type === 'journal' ? ' ccf-meta-type-journal' : ' ccf-meta-type-conference';
    card.innerHTML =
        '<div class="ccf-card-header">' +
        '<span class="ccf-card-fullname">' + hl(fullName) + '</span>' +
        '<span class="ccf-card-abbr' + (abbr === '—' ? ' empty' : '') + '">' + hl(abbr) + '</span>' +
        '</div>' +
        '<div class="ccf-card-meta">' +
        '<div class="ccf-meta-tags">' +
        '<span class="ccf-rating-block' + ratingClass + '">' + ratingDisplay + '</span>' +
        '<span class="ccf-meta-type' + typeClass + '">' + hl(typeLabel) + '</span>' +
        '</div>' +
        '<div class="ccf-meta-field">' + hl(field) + '</div>' +
        '<div class="ccf-meta-publisher">' + hl(publisher) + '</div>' +
        '</div>' +
        '<div class="ccf-card-footer">' +
        '<a href="' + escapeHtml(website) + '" target="_blank" rel="noopener" class="ccf-card-link"><i class="fas fa-external-link-alt"></i> 官网</a>' +
        '</div>';

    return card;
}

function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

function initFilters() {
    var fields = getFieldOrder();
    var typeValues = getTypeOrder();
    var ratings = getUniqueValues('Rating');

    var typeLabels = { 'journal': '期刊', 'conference': '会议' };

    createFilterButtons('filter-field', fields, currentField, '全部', function (v) {
        currentField = v;
        setActiveButton('filter-field', v);
        applyFilters();
    });

    var typeContainer = document.getElementById('filter-type');
    if (typeContainer) {
        typeContainer.innerHTML = '';
        var allBtn = document.createElement('button');
        allBtn.type = 'button';
        allBtn.className = 'filter-btn' + (currentType === '' ? ' active' : '');
        allBtn.textContent = '全部';
        allBtn.dataset.value = '';
        allBtn.addEventListener('click', function () { currentType = ''; setActiveButton('filter-type', ''); applyFilters(); });
        typeContainer.appendChild(allBtn);
        typeValues.forEach(function (v) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'filter-btn' + (currentType === v ? ' active' : '');
            btn.textContent = typeLabels[v] || v;
            btn.dataset.value = v;
            btn.addEventListener('click', function () { currentType = v; setActiveButton('filter-type', v); applyFilters(); });
            typeContainer.appendChild(btn);
        });
    }

    createFilterButtons('filter-rating', ratings, currentRating, '全部', function (v) {
        currentRating = v;
        setActiveButton('filter-rating', v);
        applyFilters();
    });

    document.getElementById('search-input').addEventListener('input', applyFilters);

    var wholeWordBtn = document.getElementById('search-whole-word');
    var caseBtn = document.getElementById('search-case');
    if (wholeWordBtn) {
        wholeWordBtn.addEventListener('click', function () {
            this.classList.toggle('active');
            applyFilters();
        });
    }
    if (caseBtn) {
        caseBtn.addEventListener('click', function () {
            this.classList.toggle('active');
            applyFilters();
        });
    }
}

function loadData() {
    var loading = document.getElementById('loading');
    var error = document.getElementById('error');
    var resultArea = document.getElementById('result-area');

    if (window.location.protocol === 'file:') {
        loading.style.display = 'none';
        error.style.display = 'block';
        return;
    }

    loading.style.display = 'block';
    error.style.display = 'none';
    resultArea.style.display = 'none';

    fetch(window.CCF_JSON_PATH || 'ccf_collect.json')
        .then(function (r) {
            if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
            return r.json();
        })
        .then(function (data) {
            if (!Array.isArray(data)) throw new Error('数据格式错误');
            allItems = data;
            loading.style.display = 'none';
            resultArea.style.display = 'block';
            updateSectionStats();
            initFilters();
            applyFilters();
        })
        .catch(function (e) {
            loading.style.display = 'none';
            error.style.display = 'block';
            error.querySelector('.error-text').textContent = '加载失败: ' + e.message;
        });
}

document.addEventListener('DOMContentLoaded', loadData);

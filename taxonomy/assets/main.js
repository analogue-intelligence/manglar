(function () {
    var tree = document.getElementById('taxonomy-tree');

    function shuffleTopLevelCategories(container) {
        var items = Array.prototype.slice.call(container.children);
        for (var i = items.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = items[i];
            items[i] = items[j];
            items[j] = tmp;
        }
        items.forEach(function (li) { container.appendChild(li); });
    }

    shuffleTopLevelCategories(tree);

    var DEFAULT_OPEN = new Set(Array.prototype.map.call(
        tree.querySelectorAll('ul.collapse.show'),
        function (el) { return el.id; }
    ));
    var searchInput = document.getElementById('tax-search');
    var expandAllBtn = document.getElementById('tax-expand-all');
    var collapseAllBtn = document.getElementById('tax-collapse-all');
    var noResults = document.getElementById('tax-no-results');

    function setExpanded(id, expanded) {
        var target = document.getElementById(id);
        if (!target) return;
        target.classList.toggle('show', expanded);
        document.querySelectorAll('[data-bs-target="#' + id + '"]').forEach(function (btn) {
            btn.setAttribute('aria-expanded', String(expanded));
        });
    }

    function ownText(li) {
        var clone = li.cloneNode(true);
        clone.querySelectorAll('button, ul, p').forEach(function (n) { n.remove(); });
        return clone.textContent.trim().toLowerCase();
    }

    function processNode(li, query, forceShow) {
        var btn = li.querySelector(':scope > button');
        var childUl = li.querySelector(':scope > ul.collapse');
        var label = btn ? btn.textContent.trim().toLowerCase() : ownText(li);
        var selfMatch = forceShow || query === '' || label.indexOf(query) !== -1;
        var childMatch = false;

        if (childUl) {
            var childForceShow = query !== '' && (forceShow || selfMatch);
            childUl.querySelectorAll(':scope > li').forEach(function (childLi) {
                if (processNode(childLi, query, childForceShow)) childMatch = true;
            });
        }

        var isMatch = selfMatch || childMatch;
        li.classList.toggle('d-none', !isMatch);

        if (childUl) {
            setExpanded(childUl.id, query === '' ? DEFAULT_OPEN.has(childUl.id) : isMatch);
        }

        return isMatch;
    }

    function filterTree(rawQuery) {
        var query = rawQuery.trim().toLowerCase();
        var anyMatch = false;
        tree.querySelectorAll(':scope > li').forEach(function (li) {
            if (processNode(li, query, false)) anyMatch = true;
        });
        noResults.classList.toggle('d-none', anyMatch);
    }

    function clearFilter() {
        searchInput.value = '';
        noResults.classList.add('d-none');
        tree.querySelectorAll('li').forEach(function (li) { li.classList.remove('d-none'); });
    }

    searchInput.addEventListener('input', function () {
        filterTree(searchInput.value);
    });

    expandAllBtn.addEventListener('click', function () {
        clearFilter();
        tree.querySelectorAll('ul.collapse').forEach(function (el) { setExpanded(el.id, true); });
    });

    collapseAllBtn.addEventListener('click', function () {
        clearFilter();
        tree.querySelectorAll('ul.collapse').forEach(function (el) { setExpanded(el.id, false); });
    });
})();
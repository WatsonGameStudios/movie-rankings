const DATA_URL = "data/movies.json";

const state = { data: null, filters: {} };
const ui = {};

fetch(DATA_URL)
  .then((res) => {
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  })
  .then((data) => {
    state.data = data;
    buildFilters();
    render();
  })
  .catch((err) => {
    document.getElementById("movies").innerHTML =
      '<p class="no_results">Could not load ' + DATA_URL + " (" + err.message +
      "). </p>";
  });

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  children.forEach((c) => node.append(c));
  return node;
}

function group(labelText, control) {
  return el("label", { className: "filter_group" }, [labelText, control]);
}

function rangeInputs(idPrefix, step) {
  const min = el("input", { type: "number", step, placeholder: "min" });
  const max = el("input", { type: "number", step, placeholder: "max" });
  min.addEventListener("input", render);
  max.addEventListener("input", render);
  const wrap = el("span", { className: "filter_range" }, [min, "–", max]);
  return { min, max, wrap };
}

function buildFilters() {
  const root = document.getElementById("filters");

  ui.search = el("input", { type: "search", placeholder: "Search titles..." });
  ui.search.addEventListener("input", render);
  root.append(group("Search", ui.search));

  ui.genre = el("select");
  ui.genre.append(el("option", { value: "", textContent: "All Genres" }));
  state.data.genres.forEach((g) =>
    ui.genre.append(el("option", { value: g.id, textContent: g.name }))
  );
  ui.genre.addEventListener("change", render);
  root.append(group("Genre", ui.genre));

  ui.year = rangeInputs("year", 1);
  root.append(group("Year", ui.year.wrap));

  ui.scores = {};
  state.data.scores.forEach((s) => {
    ui.scores[s.key] = rangeInputs(s.key, 0.5);
    root.append(group(s.label, ui.scores[s.key].wrap));
  });

  const reset = el("button", { type: "button", className: "filter_reset", textContent: "Reset" });
  reset.addEventListener("click", () => {
    ui.search.value = "";
    ui.genre.value = "";
    [ui.year, ...Object.values(ui.scores)].forEach((r) => {
      r.min.value = "";
      r.max.value = "";
    });
    render();
  });
  root.append(reset);
}

function inRange(value, range) {
  const lo = range.min.value === "" ? null : Number(range.min.value);
  const hi = range.max.value === "" ? null : Number(range.max.value);
  if (lo === null && hi === null) return true;
  if (value === undefined) return false; // movie has no value for an active filter
  return (lo === null || value >= lo) && (hi === null || value <= hi);
}

function matches(movie) {
  const q = ui.search.value.trim().toLowerCase();
  if (q && !movie.title.toLowerCase().includes(q)) return false;
  if (ui.genre.value && !movie.genres.includes(ui.genre.value)) return false;
  if (!inRange(movie.year, ui.year)) return false;
  return Object.entries(ui.scores).every(([key, range]) =>
    inRange((movie.scores || {})[key], range)
  );
}

function movieCard(movie) {
  const list = el("ul");
  const genreNames = movie.genres
    .map((id) => (state.data.genres.find((g) => g.id === id) || { name: id }).name)
    .join(", ");

  if (movie.year !== undefined) {
    const yearLi = el("li", { textContent: movie.year });
    yearLi.append(el("span", { className: "genre_label", textContent: genreNames }));
    list.append(yearLi);
  }
  state.data.scores.forEach((s) => {
    const value = (movie.scores || {})[s.key];
    if (value === undefined) return;
    const note = (movie.notes || {})[s.key];
    list.append(
      el("li", { textContent: `${s.label}: ${value}/10` + (note ? ` (${note})` : "") })
    );
  });

  const info = el("div", { className: "poster-info" }, [
    el("h2", { className: "poster-title", textContent: movie.title }),
  ]);
  if (list.children.length) info.append(list);
  if (movie.year === undefined) {
    info.append(el("div", { className: "genre_label", textContent: genreNames }));
  }

  return el("a", { href: movie.poster }, [
    el("img", { src: movie.poster, alt: movie.title, className: "poster" }),
    info,
  ]);
}

function render() {
  const { movies, genres } = state.data;
  const shown = movies.filter(matches);
  const ranked = shown.filter((m) => !m.watchlist);
  const watch = shown.filter((m) => m.watchlist);

  const genre = genres.find((g) => g.id === ui.genre.value);
  document.getElementById("genre_title").replaceChildren(
    ...(genre
      ? [el("div", { className: "page_title", textContent: `${genre.emoji} ${genre.name} ${Array.from(genre.emoji).reverse().join("")}` })]
      : [])
  );

  const grid = document.getElementById("movies");
  grid.replaceChildren(...ranked.map(movieCard));
  if (!shown.length) {
    grid.append(el("p", { className: "no_results", textContent: "No movies match those filters. ಥ﹏ಥ" }));
  }

  document.getElementById("watchlist").replaceChildren(...watch.map(movieCard));
  document.getElementById("watchlist_section").hidden = !watch.length;

  document.getElementById("result_count").textContent =
    `Showing ${shown.length} of ${movies.length} Movies`;
}

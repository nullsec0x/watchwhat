const API_KEY = '87545f40beef07b2983d215650a791fe';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

const genreSelect = document.getElementById('genre');
const yearInput = document.getElementById('year');
const ratingInput = document.getElementById('rating');
const pickMovieBtn = document.getElementById('pick-movie');
const tryAgainBtn = document.getElementById('try-again');
const movieResult = document.getElementById('movie-result');
const loadingElement = document.getElementById('loading');
const errorElement = document.getElementById('error');
const themeToggle = document.getElementById('theme-toggle');

const moviePoster = document.getElementById('movie-poster');
const movieTitle = document.getElementById('movie-title');
const movieYear = document.getElementById('movie-year');
const movieOverview = document.getElementById('movie-overview');
const movieRatingValue = document.getElementById('movie-rating-value');
const movieTmdbLink = document.getElementById('movie-tmdb-link');

let currentFilters = {
  genre: null,
  year: null,
  rating: null
};

let isFetching = false;
let activeRequestController = null;

async function init() {
  try {
    setupThemeToggle();
    const genres = await fetchGenres();
    populateGenreDropdown(genres);
    setupEventListeners();
  } catch (error) {
    showError('Failed to initialize app. Please try again later.');
    console.error('Initialization error:', error);
  }
  
  setTimeout(() => {
    document.querySelector('.controls-container').style.opacity = '1';
    document.querySelector('.controls-container').style.transform = 'translateY(0)';
  }, 100);
}

function setupThemeToggle() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.body.classList.add('dark-mode');
    themeToggle.checked = true;
  }
  
  themeToggle.addEventListener('change', () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
  });
}

async function fetchGenres() {
  try {
    const response = await fetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}&language=en-US`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    return data.genres;
  } catch (error) {
    console.error('Error fetching genres:', error);
    throw error;
  }
}

function populateGenreDropdown(genres) {
  genreSelect.innerHTML = '';
  
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Any genre';
  defaultOption.selected = true;
  genreSelect.appendChild(defaultOption);
  
  genres.forEach(genre => {
    const option = document.createElement('option');
    option.value = genre.id;
    option.textContent = genre.name;
    genreSelect.appendChild(option);
  });
}

function setupEventListeners() {
  pickMovieBtn.addEventListener('click', handlePickMovie);
  tryAgainBtn.addEventListener('click', handleTryAgain);
  
  genreSelect.addEventListener('change', (e) => {
    currentFilters.genre = e.target.value || null;
  });
  
  yearInput.addEventListener('input', (e) => {
    currentFilters.year = e.target.value || null;
  });
  
  ratingInput.addEventListener('input', (e) => {
    currentFilters.rating = e.target.value || null;
  });
}

async function handlePickMovie() {
  if (isFetching) return;
  
  if (activeRequestController) {
    activeRequestController.abort();
  }
  
  activeRequestController = new AbortController();
  const signal = activeRequestController.signal;

  if (yearInput.value && (yearInput.value < 1900 || yearInput.value > new Date().getFullYear())) {
    showError('Please enter a valid year between 1900 and current year');
    return;
  }
  
  if (ratingInput.value && (ratingInput.value < 0 || ratingInput.value > 10)) {
    showError('Please enter a valid rating between 0 and 10');
    return;
  }
  
  try {
    isFetching = true;
    disableButtons(true);
    showLoading();
    hideError();
    hideMovieResult();
    
    const queryParams = buildQueryParams();
    const discoverResponse = await fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&${queryParams}`, {signal});
    
    if (!discoverResponse.ok) {
      if (discoverResponse.status === 422) {
        throw new Error('Invalid parameters. Please adjust your filters.');
      }
      throw new Error(`API error: ${discoverResponse.status}`);
    }
    
    const discoverData = await discoverResponse.json();
    const totalPages = discoverData.total_pages > 500 ? 500 : discoverData.total_pages;
    
    if (totalPages === 0 || discoverData.total_results === 0) {
      showError('No movies found with these filters. Try different criteria.');
      return;
    }
    
    const randomPage = Math.floor(Math.random() * totalPages) + 1;
    const randomPageResponse = await fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&${queryParams}&page=${randomPage}`, {signal});
    
    if (!randomPageResponse.ok) throw new Error(`API error: ${randomPageResponse.status}`);
    
    const randomPageData = await randomPageResponse.json();
    if (randomPageData.results.length === 0) {
      showError('No movies found on this page. Try again.');
      return;
    }
  
    const randomMovieIndex = Math.floor(Math.random() * randomPageData.results.length);
    const selectedMovie = randomPageData.results[randomMovieIndex];
    displayMovie(selectedMovie);
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Request aborted by user');
      return;
    }
    showError(error.message || 'Failed to fetch movies. Please try again later.');
    console.error('Error picking movie:', error);
  } finally {
    isFetching = false;
    disableButtons(false);
    activeRequestController = null;
    hideLoading();
  }
}

function handleTryAgain() {
  if (isFetching) return;
  
  tryAgainBtn.disabled = true;
  movieResult.classList.remove('show');
  
  setTimeout(() => {
    movieResult.classList.add('hidden');
    handlePickMovie();
  }, 300);
}

function buildQueryParams() {
  const params = new URLSearchParams();
  
  if (currentFilters.genre) params.append('with_genres', currentFilters.genre);
  if (currentFilters.year) params.append('year', currentFilters.year);
  if (currentFilters.rating) params.append('vote_average.gte', currentFilters.rating);
  
  params.append('sort_by', 'popularity.desc');
  params.append('include_adult', 'false');
  params.append('include_video', 'false');
  params.append('language', 'en-US');
  
  return params.toString();
}

function displayMovie(movie) {
  const posterContainer = document.querySelector('.poster-container');
  posterContainer.innerHTML = '';
  
  if (movie.poster_path) {
    const posterImg = document.createElement('img');
    posterImg.id = 'movie-poster';
    posterImg.src = IMAGE_BASE_URL + movie.poster_path;
    posterImg.alt = `${movie.title} poster`;
    posterImg.classList.add('movie-poster');
    posterContainer.appendChild(posterImg);
  } else {
    posterContainer.innerHTML = '<div class="no-poster"><p>Poster Not Available</p></div>';
    posterContainer.style.backgroundColor = 'var(--card-bg)';
  }
  
  movieTitle.textContent = movie.title;
  movieOverview.textContent = movie.overview || 'No overview available.';
  
  const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : 'Unknown';
  movieYear.textContent = releaseYear !== 'Unknown' ? `Released: ${releaseYear}` : 'Release date unknown';
  
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
  movieRatingValue.textContent = `${rating}/10`;
  
  movieTmdbLink.href = `https://www.themoviedb.org/movie/${movie.id}`;
  
  const netflixLink = document.getElementById('movie-netflix-link');
  netflixLink.href = `https://www.netflix.com/search?q=${encodeURIComponent(movie.title)}`;
  
  setTimeout(() => {
    movieResult.style.display = 'block';
    setTimeout(() => {
      movieResult.classList.remove('hidden');
      movieResult.classList.add('show');
    }, 10);
  }, 10);
}

function disableButtons(disabled) {
  pickMovieBtn.disabled = disabled;
  tryAgainBtn.disabled = disabled;
}

function showLoading() {
  loadingElement.classList.remove('hidden');
}

function hideLoading() {
  loadingElement.classList.add('hidden');
}

function hideMovieResult() {
  movieResult.classList.remove('show');
  movieResult.classList.add('hidden');
}

function showError(message) {
  errorElement.textContent = message;
  errorElement.classList.remove('hidden');
}

function hideError() {
  errorElement.classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', init);
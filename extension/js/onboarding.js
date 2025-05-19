document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const slides = document.querySelectorAll('.slide');
  const dots = document.querySelectorAll('.dot');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const finishBtn = document.getElementById('finish-btn');
  
  let currentSlide = 0;
  const totalSlides = slides.length;
  
  // Function to update the carousel to show the current slide
  function updateCarousel() {
    // Update slides
    slides.forEach((slide, index) => {
      slide.classList.toggle('active', index === currentSlide);
    });
    
    // Update dots
    dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === currentSlide);
    });
    
    // Update navigation buttons
    prevBtn.disabled = currentSlide === 0;
    
    if (currentSlide === totalSlides - 1) {
      nextBtn.textContent = 'Finish';
    } else {
      nextBtn.textContent = 'Next →';
    }
  }
  
  // Go to previous slide
  function goToPrevSlide() {
    if (currentSlide > 0) {
      currentSlide--;
      updateCarousel();
    }
  }
  
  // Go to next slide
  function goToNextSlide() {
    if (currentSlide < totalSlides - 1) {
      currentSlide++;
      updateCarousel();
    } else {
      // On last slide, finish button behavior
      finishOnboarding();
    }
  }
  
  // Go to a specific slide when dot is clicked
  function goToSlide(slideIndex) {
    currentSlide = slideIndex;
    updateCarousel();
  }
  
  // Complete onboarding
  function finishOnboarding() {
    // Mark onboarding as completed in storage
    chrome.storage.sync.set({ onboardingCompleted: true }, () => {
      // Close the tab
      window.close();
    });
  }
  
  // Event Listeners
  prevBtn.addEventListener('click', goToPrevSlide);
  nextBtn.addEventListener('click', goToNextSlide);
  
  // Dot navigation
  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      goToSlide(index);
    });
  });
  
  // Finish button
  finishBtn.addEventListener('click', finishOnboarding);
  
  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      goToPrevSlide();
    } else if (e.key === 'ArrowRight') {
      goToNextSlide();
    }
  });
  
  // Initialize the carousel
  updateCarousel();
});

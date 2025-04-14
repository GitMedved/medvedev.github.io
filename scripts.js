document.addEventListener('DOMContentLoaded', function() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.custom-background, .project, .post').forEach(el => {
        observer.observe(el);
    });
});



document.addEventListener('DOMContentLoaded', function() {
    const sections = document.querySelectorAll('.section-header');
    
    sections.forEach(header => {
        const toggleBtn = header.querySelector('.toggle-section');
        const content = header.nextElementSibling;
        
        header.addEventListener('click', function() {
            const isCollapsed = header.classList.contains('collapsed');
            
            if (isCollapsed) {
                // Разворачиваем секцию
                header.classList.remove('collapsed');
                content.classList.remove('collapsed');
                toggleBtn.textContent = '−';
            } else {
                // Сворачиваем секцию
                header.classList.add('collapsed');
                content.classList.add('collapsed');
                toggleBtn.textContent = '+';
            }
        });
    });
});
async function loadComponent(id, file) {

    const element = document.getElementById(id);

    if (!element) return;

    const response = await fetch(file);

    const content = await response.text();

    element.innerHTML = content;

}


loadComponent("navbar", "components/navbar.html");

loadComponent("footer", "components/footer.html");
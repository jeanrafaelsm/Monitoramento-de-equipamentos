// Inicialização do Mapa
const map = L.map('map').setView([-15.788, -47.879], 5); // Coordenadas do Brasil

// Camada base do mapa (OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

async function loadEquipmentData() {
    const response = await fetch('data/equipment.json');
    return await response.json();
}

console.log("Mapa inicializado!"); // Verifique no console do navegador
// Bouton (l'input fichier est déclenché ailleurs) + glisser-déposer sur `zone` ; appelle onFile(File).
export function setupImporter(zone, input, onFile) {
  input.onchange = () => { input.files[0] && onFile(input.files[0]); input.value = ""; };
  zone.ondragover = (e) => { e.preventDefault(); zone.classList.add("over"); };
  zone.ondragleave = () => zone.classList.remove("over");
  zone.ondrop = (e) => {
    e.preventDefault();
    zone.classList.remove("over");
    e.dataTransfer.files[0] && onFile(e.dataTransfer.files[0]);
  };
  // un fichier lâché à côté de la zone ne doit pas faire quitter l'app (le navigateur l'ouvrirait)
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());
}

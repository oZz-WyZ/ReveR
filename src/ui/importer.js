// Bouton + glisser-déposer ; appelle onFile(File).
export function setupImporter(zone, input, onFile) {
  input.onchange = () => { input.files[0] && onFile(input.files[0]); input.value = ""; };
  zone.ondragover = (e) => { e.preventDefault(); zone.classList.add("over"); };
  zone.ondragleave = () => zone.classList.remove("over");
  zone.ondrop = (e) => {
    e.preventDefault();
    zone.classList.remove("over");
    e.dataTransfer.files[0] && onFile(e.dataTransfer.files[0]);
  };
}

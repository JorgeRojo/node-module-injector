export default function DevToolsOpener(): JSX.Element {
  const handleOpenDevTools = (event: React.MouseEvent): void => {
    event.preventDefault();
    window.electron.ipcRenderer.send('open-dev-tools');
  };

  return (
    <a href="#" onClick={handleOpenDevTools}>
      check dev tools console
    </a>
  );
}

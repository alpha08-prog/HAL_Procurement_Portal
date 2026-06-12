export default function ScreenStub({ title, note }) {
  return (
    <section className="screen">
      <h1 className="screen-title">{title}</h1>
      <div className="stub-card">
        <p>{note ?? 'This screen is a placeholder — it will be built in a later session.'}</p>
      </div>
    </section>
  );
}

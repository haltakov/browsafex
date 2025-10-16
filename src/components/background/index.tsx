export default function Background() {
  return (
    <div className="fixed inset-0 z-10 min-h-[calc(100dvh)] bg-[#222]">
      <picture className="w-full h-full object-cover opacity-30">
        <source
          type="image/avif"
          media="(max-aspect-ratio: 9/16)"
          srcSet="
          /browsafex_background-ver-360.avif 360w,
          /browsafex_background-ver-480.avif 480w,
          /browsafex_background-ver-720.avif 720w,
          /browsafex_background-ver-1080.avif 1080w"
          sizes="(max-aspect-ratio: 9/16) 100vw, 50vw"
        />

        <source
          type="image/jpeg"
          media="(max-aspect-ratio: 9/16)"
          srcSet="
          /browsafex_background-ver-360.jpg 360w,
          /browsafex_background-ver-480.jpg 480w,
          /browsafex_background-ver-720.jpg 720w,
          /browsafex_background-ver-1080.jpg 1080w"
          sizes="(max-aspect-ratio: 9/16) 100vw, 50vw"
        />

        <source
          type="image/avif"
          srcSet="
          /browsafex_background-hor-640.avif 640w,
          /browsafex_background-hor-960.avif 960w,
          /browsafex_background-hor-1280.avif 1280w,
          /browsafex_background-hor-1920.avif 1920w,
          /browsafex_background-hor-2880.avif 2880w"
          sizes="100vw"
        />

        <source
          type="image/jpeg"
          srcSet="
          /browsafex_background-hor-640.jpg 640w,
          /browsafex_background-hor-960.jpg 960w,
          /browsafex_background-hor-1280.jpg 1280w,
          /browsafex_background-hor-1920.jpg 1920w,
          /browsafex_background-hor-2880.jpg 2880w"
          sizes="100vw"
        />

        <img
          className="w-full h-full object-cover opacity-30"
          src="/browsafex_background-hor-2880.jpg"
          alt="Browsafex background"
        />
      </picture>
    </div>
  );
}

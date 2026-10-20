import { lazy, Suspense } from "react";
import { MediaStoreProvider } from "./hooks/useMediaStore";
import { BootReady } from "./boot";
import {
  getImageViewerPathFromHash,
  isImageViewerRoute,
} from "./utils/imageWindow";
import {
  getMdViewerPathFromHash,
  isMdViewerRoute,
} from "./utils/mdWindow";
import {
  getPdfViewerPathFromHash,
  isPdfViewerRoute,
} from "./utils/pdfWindow";
import {
  getVideoPlayerPathFromHash,
  isVideoPlayerRoute,
} from "./utils/videoWindow";
import "./App.css";

const AppShell = lazy(() =>
  import("./components/AppShell").then((m) => ({ default: m.AppShell })),
);
const VideoPlayerWindow = lazy(() =>
  import("./components/VideoPlayerWindow").then((m) => ({
    default: m.VideoPlayerWindow,
  })),
);
const PdfViewerWindow = lazy(() =>
  import("./components/PdfViewerWindow").then((m) => ({
    default: m.PdfViewerWindow,
  })),
);
const MarkdownViewerWindow = lazy(() =>
  import("./components/MarkdownViewerWindow").then((m) => ({
    default: m.MarkdownViewerWindow,
  })),
);
const ImageViewerWindow = lazy(() =>
  import("./components/ImageViewerWindow").then((m) => ({
    default: m.ImageViewerWindow,
  })),
);

function RouteFallback() {
  return null;
}

function App() {
  const videoRoute = isVideoPlayerRoute();
  const pdfRoute = isPdfViewerRoute();
  const mdRoute = isMdViewerRoute();
  const imageRoute = isImageViewerRoute();
  const videoPath = videoRoute ? getVideoPlayerPathFromHash() : null;
  const pdfPath = pdfRoute ? getPdfViewerPathFromHash() : null;
  const mdPath = mdRoute ? getMdViewerPathFromHash() : null;
  const imagePath = imageRoute ? getImageViewerPathFromHash() : null;

  return (
    <MediaStoreProvider>
      <Suspense fallback={<RouteFallback />}>
        {videoRoute ? (
          <BootReady>
            <VideoPlayerWindow initialPath={videoPath} />
          </BootReady>
        ) : pdfRoute ? (
          <BootReady>
            <PdfViewerWindow initialPath={pdfPath} />
          </BootReady>
        ) : mdRoute ? (
          <BootReady>
            <MarkdownViewerWindow initialPath={mdPath} />
          </BootReady>
        ) : imageRoute ? (
          <BootReady>
            <ImageViewerWindow initialPath={imagePath} />
          </BootReady>
        ) : (
          <BootReady>
            <AppShell />
          </BootReady>
        )}
      </Suspense>
    </MediaStoreProvider>
  );
}

export default App;

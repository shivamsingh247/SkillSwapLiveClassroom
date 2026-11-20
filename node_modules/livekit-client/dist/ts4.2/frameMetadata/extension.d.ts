import type { Disposable, SlotProvider } from '../room/extensions';
import type { FrameMetadataOptions } from './FrameMetadataManager';
import { FrameMetadataManager } from './FrameMetadataManager';
/**
 * Frame metadata extraction on subscribed video tracks (`frameMetadata` room option).
 * Publishing frame metadata is part of the core publish path and needs no extension.
 * @experimental
 */
export declare const frameMetadata: import("..").ConfigurableExtension<Partial<SlotProvider<"frameMetadataOptions">> & Disposable & {
    manager: FrameMetadataManager;
}, FrameMetadataOptions, readonly [
]>;
//# sourceMappingURL=extension.d.ts.map

export default class MockMediaStream extends MediaStream {
    readonly id: string;
    constructor(id: string, tracks: MediaStreamTrack[]);
    getTracks(): MediaStreamTrack[];
}
//# sourceMappingURL=MockMediaStream.d.ts.map

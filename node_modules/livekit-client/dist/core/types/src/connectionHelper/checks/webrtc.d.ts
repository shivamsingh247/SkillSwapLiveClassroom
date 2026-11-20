import { Checker } from './Checker';
export declare class WebRTCCheck extends Checker {
    get description(): string;
    protected perform(): Promise<void>;
}

/**
 * The one recogniser instance.
 *
 * The formula model is 76 MB of WASM-resident weights; loading it twice because two panels
 * each made their own would be a silent doubling of memory on exactly the school laptops that
 * can least afford it. Everything that reads mathematics from pixels shares this instance
 * (Law 5 — one authority per fact, including the fact of a loaded model).
 */

import { OnDeviceRecogniser } from './ondevice';

export const recogniser = new OnDeviceRecogniser();

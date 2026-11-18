import * as mockSeed from '../data/mockData';
import { mockRequest } from './mockClient';

/** Initial records for the whole portal. Replace with NestJS endpoints when the backend exists. */
export const loadWorkspace = () => mockRequest(() => mockSeed);

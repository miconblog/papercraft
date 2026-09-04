import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// vitest globals가 꺼져 있어(`vitest.config.mts`) RTL이 afterEach를 자동으로
// 찾지 못한다 — 여기서 명시하지 않으면 한 파일 안의 여러 테스트가 렌더링을
// 공유해 이전 테스트의 DOM이 남는다.
afterEach(cleanup);

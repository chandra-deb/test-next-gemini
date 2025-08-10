interface JiebaModule {
  cut(text: string, hmm?: boolean): string[];
  default: (module_or_path?: any) => Promise<any>;
}

class JiebaService {
  private jieba: JiebaModule | null = null;
  private isLoading = false;
  private loadPromise: Promise<JiebaModule> | null = null;

  async loadJieba(): Promise<JiebaModule> {
    if (this.jieba) {
      return this.jieba;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this.doLoadJieba();
    return this.loadPromise;
  }

  private async doLoadJieba(): Promise<JiebaModule> {
    try {
      this.isLoading = true;
      
      // Dynamic import of jieba-wasm
      const jiebaWasm = await import('jieba-wasm');
      
      // Initialize jieba with default init
      await jiebaWasm.default();
      
      this.jieba = jiebaWasm;
      this.isLoading = false;
      
      return jiebaWasm;
    } catch (error) {
      this.isLoading = false;
      this.loadPromise = null;
      throw error;
    }
  }

  async segmentText(text: string): Promise<string[]> {
    const jieba = await this.loadJieba();
    return jieba.cut(text, true); // Use HMM for better accuracy
  }

  isJiebaLoaded(): boolean {
    return this.jieba !== null;
  }

  isJiebaLoading(): boolean {
    return this.isLoading;
  }
}

export const jiebaService = new JiebaService();

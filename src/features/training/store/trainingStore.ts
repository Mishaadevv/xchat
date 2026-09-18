import { trainingService, type TrainingConfig, type DatasetInfo, type TrainedModel } from "@/services/training";

export const trainingStore = {
  subscribe: trainingService.subscribe,
  getState: trainingService.getState,

  async checkEnvironment() {
    return trainingService.checkEnvironment();
  },
  getDatasets: () => trainingService.getDatasets(),
  importDataset: (path: string) => trainingService.importDataset(path),
  removeDataset: (id: string) => trainingService.removeDataset(id),
  startTraining: (config: TrainingConfig) => trainingService.startTraining(config),
  stopTraining: () => trainingService.stopTraining(),
  getTrainedModels: () => trainingService.getTrainedModels(),
  deleteModel: (id: string) => trainingService.deleteModel(id),
  getTrainingProgress: () => trainingService.getTrainingProgress(),
  isTrainingActive: () => trainingService.isTrainingActive(),
};

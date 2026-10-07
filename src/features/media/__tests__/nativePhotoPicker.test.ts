const mockLibrary = jest.fn(), mockCamera = jest.fn(), mockPermission = jest.fn(), mockManipulate = jest.fn();
const mockFiles = new Map<string, { size: number; bytes: ArrayBuffer; exists: boolean }>(), mockDelete = jest.fn();
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: (...a: unknown[]) => mockLibrary(...a),
  launchCameraAsync: (...a: unknown[]) => mockCamera(...a), requestCameraPermissionsAsync: () => mockPermission() }));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: { manipulate: (...a: unknown[]) => mockManipulate(...a) }, SaveFormat: { JPEG: 'jpeg' } }));
jest.mock('expo-file-system', () => ({ Paths: { cache: { uri: 'file:///cache/' } }, File: class {
  uri: string; constructor(value: string) { this.uri = value; } get exists() { return mockFiles.get(this.uri)?.exists ?? false; }
  get size() { return mockFiles.get(this.uri)?.size ?? 0; }
  async arrayBuffer() { return mockFiles.get(this.uri)?.bytes; }
  delete() { mockDelete(this.uri); }
} }));
import { pickPreparedPhoto, pickPreparedPhotos, photoSelectionSkipped, PhotoSelectionError } from '../nativePhotoPicker';
const original = 'file:///cache/picker/original.jpg', saved = 'file:///cache/output.jpg';
const resize = jest.fn(), render = jest.fn(), save = jest.fn(), releaseContext = jest.fn(), releaseImage = jest.fn();
beforeEach(() => {
  jest.clearAllMocks(); mockFiles.clear();
  mockFiles.set(original, { size: 80, bytes: new ArrayBuffer(80), exists: true });
  mockFiles.set(saved, { size: 12, bytes: new ArrayBuffer(12), exists: true });
  mockLibrary.mockResolvedValue({ canceled: false, assets: [{ uri: original, width: 4000, height: 3000, fileSize: 80 }] });
  mockCamera.mockImplementation(() => mockLibrary()); mockPermission.mockResolvedValue({ granted: true });
  save.mockResolvedValue({ uri: saved, width: 1600, height: 1200 });
  render.mockResolvedValue({ saveAsync: save, release: releaseImage });
  mockManipulate.mockReturnValue({ resize, renderAsync: render, release: releaseContext });
});
it('prepares a resized JPEG in memory and removes both owned cache copies with no metadata request', async () => {
  const result = await pickPreparedPhoto('LIBRARY', () => true);
  expect(result).toEqual({ bytes: new ArrayBuffer(12), width: 1600, height: 1200, contentType: 'image/jpeg' });
  expect(resize).toHaveBeenCalledWith({ width: 1600 }); expect(save).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.85 });
  expect(mockLibrary.mock.calls[0][0]).toMatchObject({ exif: false, base64: false, mediaTypes: ['images'] });
  expect(mockPermission).not.toHaveBeenCalled(); expect(mockDelete.mock.calls.flat()).toEqual([saved, original]);
  expect(releaseContext).toHaveBeenCalledTimes(1); expect(releaseImage).toHaveBeenCalledTimes(1);
});
it('rejects a selected input over the approved size before decoding it', async () => {
  mockFiles.get(original)!.size = 10 * 1024 * 1024 + 1;
  await expect(pickPreparedPhoto('LIBRARY', () => true)).rejects.toEqual(new PhotoSelectionError('SIZE'));
  expect(mockManipulate).not.toHaveBeenCalled(); expect(mockDelete).toHaveBeenCalledWith(original);
});
it('retires a selection returned after account or focus change and cleans its cache copy', async () => {
  let current = true; mockLibrary.mockImplementation(async () => { current = false;
    return { canceled: false, assets: [{ uri: original, width: 20, height: 20 }] }; });
  expect(await pickPreparedPhoto('LIBRARY', () => current)).toBeNull();
  expect(mockManipulate).not.toHaveBeenCalled(); expect(mockDelete).toHaveBeenCalledWith(original);
});
it('never deletes the selected library original or a path outside cache', async () => {
  const uri = 'content://media/external/images/123'; mockFiles.set(uri, mockFiles.get(original)!);
  mockLibrary.mockResolvedValue({ canceled: false, assets: [{ uri, width: 4000, height: 3000 }] });
  await pickPreparedPhoto('LIBRARY', () => true);
  expect(mockDelete.mock.calls.flat()).toEqual([saved]);
});
it('requires camera permission and does not open the camera on denial', async () => {
  mockPermission.mockResolvedValue({ granted: false });
  await expect(pickPreparedPhoto('CAMERA', () => true)).rejects.toEqual(new PhotoSelectionError('PERMISSION'));
  expect(mockCamera).not.toHaveBeenCalled(); expect(mockManipulate).not.toHaveBeenCalled();
});

// Owner, 2026-10-07: several photos from one gallery pick, up to the slots still free; the camera takes one.
describe('several photos from one pick', () => {
  const copy = (n: number) => `file:///cache/picker/photo-${n}.jpg`;
  beforeEach(() => {
    for (const n of [1, 2, 3]) mockFiles.set(copy(n), { size: 80, bytes: new ArrayBuffer(80), exists: true });
    mockLibrary.mockResolvedValue({ canceled: false, assets: [1, 2, 3].map(n => ({ uri: copy(n), width: 1200, height: 900, fileSize: 80 })) });
  });
  it('asks the gallery for no more than the free slots, prepares each in turn, and cleans every copy it does not keep', async () => {
    const steps: string[] = [];
    const result = await pickPreparedPhotos('LIBRARY', () => true, { limit: 2, onProcessing: (index, total) => steps.push(`${index}/${total}`) });
    expect(mockLibrary.mock.calls[0][0]).toMatchObject({ allowsMultipleSelection: true, selectionLimit: 2, orderedSelection: true,
      allowsEditing: false, exif: false });
    expect(result?.photos).toHaveLength(2); expect(result?.rejected).toBe(0);
    expect(steps).toEqual(['1/2', '2/2']);
    // The third copy the picker handed back beyond the limit is removed too; the library originals are never touched.
    expect(mockDelete.mock.calls.flat()).toEqual(expect.arrayContaining([copy(1), copy(2), copy(3)]));
    expect(releaseContext).toHaveBeenCalledTimes(2);
  });
  it('leaves out a photo that is too large, counts it, and still prepares the rest', async () => {
    mockFiles.get(copy(2))!.size = 10 * 1024 * 1024 + 1;
    const result = await pickPreparedPhotos('LIBRARY', () => true, { limit: 6 });
    expect(result?.photos).toHaveLength(2); expect(result?.rejected).toBe(1);
    expect(result?.firstError).toEqual(new PhotoSelectionError('SIZE'));
    expect(photoSelectionSkipped(1, result!.firstError)).toBe('Jedna fotografija nije dodata. Dozvoljeno je do 10 MB po slici.');
    expect(photoSelectionSkipped(5, null)).toBe('5 fotografija nije dodato. Pokušaj ponovo ili izaberi drugu.');
  });
  it('throws the reason when none could be prepared, and the camera always takes one', async () => {
    for (const n of [1, 2, 3]) mockFiles.get(copy(n))!.size = 10 * 1024 * 1024 + 1;
    await expect(pickPreparedPhotos('LIBRARY', () => true, { limit: 6 })).rejects.toEqual(new PhotoSelectionError('SIZE'));
    mockCamera.mockResolvedValue({ canceled: false, assets: [{ uri: original, width: 4000, height: 3000, fileSize: 80 }] });
    const camera = await pickPreparedPhotos('CAMERA', () => true, { limit: 6 });
    expect(mockCamera.mock.calls[0][0]).toMatchObject({ allowsMultipleSelection: false }); expect(camera?.photos).toHaveLength(1);
  });
  it('drops the whole pick when the screen is left while photos are prepared', async () => {
    let current = true;
    save.mockImplementationOnce(async () => { current = false; return { uri: saved, width: 1200, height: 900 }; });
    expect(await pickPreparedPhotos('LIBRARY', () => current, { limit: 3 })).toBeNull();
    expect(mockDelete.mock.calls.flat()).toEqual(expect.arrayContaining([copy(1), copy(2), copy(3)]));
  });
});

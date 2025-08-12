/*
 *
 * Folders.io P2P server example.
 *
 * Uses the folders API to serve files and folders from various providers.
 *
 */

export default function (o, channel) {
  var self = o;
  channel.subscribe("DirectoryListRequest", function (data, envelope) {
    console.log("ready to list it", data);
    self.provider.onList(data);
  });

  channel.subscribe("FileRequest", function (data, envelope) {
    console.log("ready to blob it", data);
    self.provider.onBlob(data);
  });

  channel.subscribe("SetFilesRequest", function (data, envelope) {
    var shareName = Math.random().toString(36).substring(7);
    var shareId = uuid();
    var streamId = data.streamId;
    var SetFilesResponse = {
      shareId: shareId,
      shareName: shareName,
    };
    fio.post(
      streamId,
      JSON.stringify(SetFilesResponse),
      {},
      channel.session.shareId,
    );
  });

  return;
}

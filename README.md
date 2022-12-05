# 大文件上传方案

## 前端

1. 计算md5,保证文件唯一性, 计算方式为md5(前2mb + 后2mb + 文件名 + 文件修改时间 + 文件大小), 得到文件唯一标识fileId

2. Blob.slice 将文件分成若干个chunk,得到总分片次数total和数组 **[{chunkNo, chunk}, ...]** 

3. 记录fileId和未上传的chunkNo,保存到localStorage(合并成功后删除)

4. 使用XMLHttpRequest上传文件,formdata包含3个字段fileId, chunkNo, file(该分片)

5. 上传完成后通知后端合并文件fileId,fileName,total

## 后端

1. 将前端传来的chunk块保存到磁盘, tmp/${fileId}/0.chunk

2. 收到合并请求后,按照分片名依次写入文件,返回文件url

后端可以用压缩算法gzip,br等对传输进行优化

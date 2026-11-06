const RE=require('resedit'),fs=require('fs');const f='dist/win-unpacked/ejStudio.exe', V=require('./package.json').version.split('.').map(Number);
const exe=RE.NtExecutable.from(fs.readFileSync(f)),res=RE.NtExecutableResource.from(exe);
const ico=RE.Data.IconFile.from(fs.readFileSync('logos/ejstudio.ico'));
RE.Resource.IconGroupEntry.replaceIconsForResource(res.entries,1,1033,ico.icons.map(i=>i.data));
const vi=RE.Resource.VersionInfo.fromEntries(res.entries)[0];
vi.setStringValues({lang:1033,codepage:1200},{FileDescription:'ejStudio',ProductName:'ejStudio',CompanyName:'ejStudio',OriginalFilename:'ejStudio.exe',InternalName:'ejStudio'});
vi.setFileVersion(V[0],V[1],V[2],0,1033);vi.setProductVersion(V[0],V[1],V[2],0,1033);vi.outputToResourceEntries(res.entries);
res.outputResource(exe);fs.writeFileSync(f,Buffer.from(exe.generate()));console.log('icon set');

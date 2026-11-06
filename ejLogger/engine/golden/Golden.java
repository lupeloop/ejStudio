import java.io.*; import java.util.*; import java.text.DecimalFormat;
import com.romraider.logger.ecu.definition.EcuParameterConvertorImpl; import com.romraider.Settings; import com.romraider.logger.ecu.ui.handler.dash.GaugeMinMax;
public class Golden { public static void main(String[] a) throws Exception {
  BufferedReader r=new BufferedReader(new InputStreamReader(new FileInputStream("conv_cases.tsv"),"UTF-8")); PrintWriter w=new PrintWriter(new OutputStreamWriter(new FileOutputStream("conv_golden.tsv"),"UTF-8")); String l;
  Map<String,EcuParameterConvertorImpl> cache=new HashMap<>();
  while((l=r.readLine())!=null){ if(l.isEmpty()) continue; String[] f=l.split("\t",-1); String key=f[1]+"|"+f[2]+"|"+f[3]+"|"+f[4];
    EcuParameterConvertorImpl c=cache.get(key); if(c==null){ c=new EcuParameterConvertorImpl(f[1],f[2],f[3],-1,f[4],Settings.Endian.BIG,new HashMap<String,String>(),new GaugeMinMax(0,0,0)); cache.put(key,c); }
    byte[] b=new byte[f[5].length()/2]; for(int i=0;i<b.length;i++) b[i]=(byte)Integer.parseInt(f[5].substring(2*i,2*i+2),16);
    double v=c.convert(b); w.println(l+"\t"+Double.toString(v)+"\t"+c.format(v)); }
  w.close(); r=new BufferedReader(new InputStreamReader(new FileInputStream("fmt_cases.tsv"),"UTF-8")); w=new PrintWriter(new OutputStreamWriter(new FileOutputStream("fmt_golden.tsv"),"UTF-8"));
  Map<String,DecimalFormat> fc=new HashMap<>();
  while((l=r.readLine())!=null){ if(l.isEmpty()) continue; String[] f=l.split("\t"); DecimalFormat d=fc.computeIfAbsent(f[0],DecimalFormat::new); w.println(l+"\t"+d.format(Double.parseDouble(f[1]))); } w.close(); } }

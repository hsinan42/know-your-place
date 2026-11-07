FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY NuGet.Config ./
COPY backend/Finance.Api/Finance.Api.csproj backend/Finance.Api/
COPY backend/Finance.Application/Finance.Application.csproj backend/Finance.Application/
COPY backend/Finance.Domain/Finance.Domain.csproj backend/Finance.Domain/
COPY backend/Finance.Infrastructure/Finance.Infrastructure.csproj backend/Finance.Infrastructure/
RUN dotnet restore backend/Finance.Api/Finance.Api.csproj
COPY backend/ backend/
RUN dotnet publish backend/Finance.Api/Finance.Api.csproj -c Release -o /out --no-restore /p:UseAppHost=false
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
RUN mkdir /data && chown app:app /data
COPY --from=build /out .
ENV ASPNETCORE_URLS=http://+:8080 DATA_DIR=/data
USER app
EXPOSE 8080
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=10 \
  CMD bash -c 'exec 3<>/dev/tcp/127.0.0.1/8080; printf "GET /health HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n" >&3; read -r status <&3; [[ "$status" == "HTTP/1.1 200 "* ]]'
ENTRYPOINT ["dotnet","Finance.Api.dll"]
